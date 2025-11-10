import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import yaml
import re
import os
import logging
from bs4 import BeautifulSoup
import html2text
from datetime import datetime
import time
from dotenv import load_dotenv
import google.generativeai as genai
from collections import deque
import json

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

print("Current working directory:", os.getcwd())

load_dotenv()

# Configure the Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=GEMINI_API_KEY)

class CustomDumper(yaml.SafeDumper):
    def increase_indent(self, flow=False, indentless=False):
        return super(CustomDumper, self).increase_indent(flow, False)

class RateLimiter:
    def __init__(self, max_calls, period):
        self.max_calls = max_calls
        self.period = period
        self.calls = deque()

    def __call__(self, f):
        def wrapped(*args, **kwargs):
            now = time.time()
            
            # Remove old calls
            while self.calls and now - self.calls[0] >= self.period:
                self.calls.popleft()

            if len(self.calls) >= self.max_calls:
                sleep_time = self.period - (now - self.calls[0])
                logger.info(f"Rate limit reached. Sleeping for {sleep_time:.2f} seconds.")
                time.sleep(sleep_time)
                now = time.time()

            self.calls.append(now)
            return f(*args, **kwargs)
        return wrapped

# Create a rate limiter
rate_limiter = RateLimiter(max_calls=9, period=60)

def create_session_with_retries():
    """Create a requests session with retry logic"""
    session = requests.Session()
    
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"]
    )
    
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    
    return session

@rate_limiter
def extract_funding_info(text):
    try:
        model = genai.GenerativeModel('gemini-flash-latest')
        prompt = f"""
        Extract funding information from the following text. If funding is mentioned, provide the amount and currency. If no funding is mentioned, say 'No funding mentioned'.

        Text: {text[:1000]}

        Respond in the following format:
        Amount: [number or 'None']
        Currency: [currency code or symbol, or 'None']
        Confidence: [High/Medium/Low]
        """

        response = model.generate_content(prompt)
        result = response.text

        # Parse the result
        amount_match = re.search(r'Amount: (.+)', result)
        currency_match = re.search(r'Currency: (.+)', result)
        confidence_match = re.search(r'Confidence: (.+)', result)

        amount = amount_match.group(1) if amount_match else None
        currency = currency_match.group(1) if currency_match else None
        confidence = confidence_match.group(1) if confidence_match else 'Low'

        if amount == 'None' or currency == 'None':
            amount = None
            currency = None

        return {
            'amount': amount,
            'currency': currency,
            'confidence': confidence,
            'model_used': 'gemini-flash-latest'
        }

    except Exception as e:
        logger.error(f"Error in extract_funding_info: {str(e)}")
        return {
            'amount': None,
            'currency': None,
            'confidence': None,
            'error': str(e),
            'model_used': 'none'
        }

def fetch_html_content(url):
    header = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=header, timeout=30)
        if response.status_code == 200:
            return response.text
    except Exception as e:
        logger.error(f"Error fetching HTML content from {url}: {str(e)}")
    return None


def parse_html_content(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Extract timestamp
    time_element = soup.find('time', class_='post-time')
    datetime_value = time_element['datetime'] if time_element else ""
    unix_timestamp = convert_to_unix_timestamp(datetime_value)
    
    # Extract tags
    discourse_tags = [tag.text for tag in soup.find_all('a', class_='discourse-tag')]
    
    # Extract meta content and title
    meta_content = soup.find('meta', attrs={'name': 'description'})['content'] if soup.find('meta', attrs={'name': 'description'}) else ""
    title_content = soup.title.string.split(':')[-1].replace('- GIPs - Gnosis','').strip() if soup.title else ""
    
    # Clean up HTML content
    clean_html_content(soup)
    
    # Remove title from body content
    title_elements = soup.find_all(['h1', 'h2'])
    for element in title_elements:
        if element.get_text().strip().lower() == title_content.lower() or \
           element.get_text().strip().startswith(f"GIP-") or \
           "Should" in element.get_text():
            element.decompose()
            break
    
    # Convert remaining content to Markdown
    markdown_text = html_to_markdown(str(soup.body))
    
    # Remove any remaining title-like lines from the start of the markdown
    markdown_lines = markdown_text.split('\n')
    while markdown_lines and (
        markdown_lines[0].strip().lower() == title_content.lower() or
        markdown_lines[0].strip().startswith("# GIP-") or
        "Should" in markdown_lines[0]
    ):
        markdown_lines.pop(0)
    
    # Rejoin the markdown text, skipping empty lines at the start
    while markdown_lines and not markdown_lines[0].strip():
        markdown_lines.pop(0)
    
    markdown_text = '\n'.join(markdown_lines)
    cleaned_body = clean_body_content(markdown_text)
    
    # Refine the cleaned_body for consistent formatting
    final_body = refine_body_with_regex(cleaned_body)
    
    return final_body, meta_content, title_content, unix_timestamp, discourse_tags


def refine_body_with_regex(text):
    # Rule 2: Remove links but keep anchor text
    # Remove markdown links [text](url) and keep 'text'
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove standalone URLs
    text = re.sub(r'(?<!\w)(https?://[^\s]+)', '', text)

    return text

@rate_limiter
def refine_body_with_gemini(cleaned_body):
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        max_chunk_size = 10000  

        # Split the cleaned_body into chunks of reasonable size
        chunks = [cleaned_body[i:i+max_chunk_size] for i in range(0, len(cleaned_body), max_chunk_size)]
        
        refined_chunks = []
        for chunk in chunks:
            prompt = f"""
Please format the following text according to these instructions:

1. **Headers and Sections**: Format headers and sections appropriately using markdown headings (e.g., `#`, `##`, `###`).

2. **Links**: Keep the anchor text of any hyperlinks but omit the URLs themselves.

3. **Conclusion**: Include content up to and including the 'Conclusion' section. Do not include any text that follows.

4. **Code Snippets**: Place any code snippets or JSON data (dictionary) into code blocks and format them properly (e.g., ```json```).


**Text:**
{chunk}

**Please provide the formatted text below without adding any new content nor comments. 
Revisit your answer twice and make sure all formatting is correct**
"""

            response = model.generate_content(prompt)
            
            # Check if the response contains text
            if hasattr(response, 'text') and response.text:
                refined_chunk = response.text.strip()
            else:
                logger.warning("Received empty or blocked response from the model. Using original chunk.")
                refined_chunk = chunk  # Use the original chunk if the model response is empty or blocked
            
            refined_chunks.append(refined_chunk)
        
        # Combine the refined chunks
        refined_body = '\n'.join(refined_chunks)
        return refined_body

    except Exception as e:
        logger.error(f"Error in refine_body_with_gemini: {str(e)}")
        return cleaned_body


def clean_body_content(body_text):
    # Split into lines for processing
    lines = body_text.split('\n')
    
    # Find where the actual content starts
    content_start = 0
    in_header = False
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Skip empty lines
        if not line:
            continue
            
        # Check for header section markers
        if line.startswith('GIP:') or line == '0 voters':
            in_header = True
            continue
            
        # Look for common content start markers
        if (line.startswith('##') or 
            line.startswith('Category') or
            line.startswith('Executive Summary') or
            line.startswith('Simple Summary') or
            line.startswith('Abstract') or
            line.startswith('Motivation')):
            content_start = i
            break
            
        # If we're not in a header section and find substantial content, start here
        if not in_header and len(line) > 20 and not line.startswith('*'):
            content_start = i
            break
    
    # Join remaining lines
    cleaned_content = '\n'.join(lines[content_start:])
    
    # Remove any leading empty lines
    cleaned_content = cleaned_content.lstrip()
    
    return cleaned_content

def convert_to_unix_timestamp(datetime_value):
    if datetime_value:
        dt_obj = datetime.strptime(datetime_value, "%Y-%m-%dT%H:%M:%SZ")
        return int(time.mktime(dt_obj.timetuple()))
    return ""


def clean_html_content(soup):
    elements_to_remove = [
        ('div', {'itemprop': 'comment'}),
        ('header', {}),
        ('footer', {}),
        ('div', {'id': 'topic-title'}),
        ('span', {'class': 'creator'}),
        ('span', {'class': 'crawler-post-infos'})
    ]
    for tag, attrs in elements_to_remove:
        for element in soup.find_all(tag, attrs):
            element.decompose()

def html_to_markdown(html_content):
    converter = html2text.HTML2Text()
    converter.ignore_links = False
    converter.body_width = 0
    return converter.handle(html_content)

def extract_info_from_meta(content):
    patterns = {
        'gip_number': r'GIP: (\d+)',
        'author': r'author: ([^,]+)',
        'state': r'status: (.*?)(?:, [a-z]+:|$)',
        'type': r'type: ([^,]+)',
        'created': r'created: (\d{4}-\d{2}-\d{2})'
    }
    return {key: re.search(pattern, content, re.IGNORECASE).group(1).strip() if re.search(pattern, content, re.IGNORECASE) else None 
            for key, pattern in patterns.items()}

def fetch_forum_gips_via_api():
    """
    Fetch GIPs using Discourse's public API endpoints.
    This method is more reliable and less likely to be blocked.
    """
    max_gip = 0
    topics = []
    page = 0
    
    headers = {
        "User-Agent": "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "Accept": "application/json",
    }
    
    session = create_session_with_retries()
    
    try:
        # Discourse API: fetch topics from the category
        # Category ID 20 is for GIPs
        while True:
            # Use the topics API endpoint
            url = f"https://forum.gnosis.io/c/dao/gips/20/l/latest.json?page={page}"
            logger.info(f"Fetching from: {url}")
            
            time.sleep(0.5)  # Be respectful
            
            try:
                resp = session.get(url, headers=headers, timeout=30)
                
                # If we get a 405 or captcha, try the alternative endpoint
                if resp.status_code == 405 or 'captcha' in resp.text.lower():
                    logger.warning(f"Got blocked response, trying RSS feed fallback")
                    return fetch_forum_gips_via_rss()
                
                resp.raise_for_status()
                data = resp.json()
                
            except requests.exceptions.RequestException as e:
                logger.error(f"Error fetching page {page}: {str(e)}")
                # Try RSS fallback
                if page == 0:  # Only try fallback on first page failure
                    logger.info("Trying RSS feed fallback")
                    return fetch_forum_gips_via_rss()
                break
            
            topic_list = data.get("topic_list", {})
            new_topics = topic_list.get("topics", [])
            
            if not new_topics:
                break
                
            topics.extend(new_topics)
            
            for t in new_topics:
                m = re.search(r'GIP-?(\d+)', t.get('slug', ''), re.IGNORECASE)
                if m:
                    max_gip = max(max_gip, int(m.group(1)))
            
            # Check if there are more pages
            if not topic_list.get("more_topics_url"):
                break
                
            page += 1
            
            # Safety limit
            if page > 20:
                logger.warning("Reached page limit, stopping")
                break
        
        logger.info(f"Fetched {len(topics)} topics, max GIP number: {max_gip}")
        return max_gip, topics
        
    except Exception as e:
        logger.error(f"Error in fetch_forum_gips_via_api: {str(e)}")
        # Try RSS as last resort
        logger.info("Trying RSS feed fallback")
        return fetch_forum_gips_via_rss()
    finally:
        session.close()

def fetch_forum_gips_via_rss():
    """
    Fallback method using RSS feed which is less likely to be blocked.
    RSS feeds are typically more permissive for automated access.
    """
    logger.info("Using RSS feed fallback method")
    max_gip = 0
    topics = []
    
    headers = {
        "User-Agent": "gip-dashboard-scraper/1.0 (+https://github.com/gnosischain/gip_dashboard)",
    }
    
    try:
        # Discourse RSS feeds don't require authentication and are rarely blocked
        url = "https://forum.gnosis.io/c/dao/gips/20.rss"
        logger.info(f"Fetching RSS from: {url}")
        
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        from xml.etree import ElementTree as ET
        root = ET.fromstring(response.content)
        
        # Parse RSS feed
        for item in root.findall('.//item'):
            title_elem = item.find('title')
            link_elem = item.find('link')
            
            if title_elem is not None and link_elem is not None:
                title = title_elem.text
                link = link_elem.text
                
                # Extract slug from link
                slug = link.rstrip('/').split('/')[-1] if link else ''
                
                # Create topic dict similar to JSON API response
                topic = {
                    'slug': slug,
                    'title': title,
                }
                topics.append(topic)
                
                # Extract GIP number
                m = re.search(r'GIP-?(\d+)', slug, re.IGNORECASE)
                if m:
                    max_gip = max(max_gip, int(m.group(1)))
        
        logger.info(f"Fetched {len(topics)} topics from RSS, max GIP number: {max_gip}")
        return max_gip, topics
        
    except Exception as e:
        logger.error(f"Error fetching RSS feed: {str(e)}")
        return 0, []

def fetch_snapshot_proposals(max_gip):
    logger.info(f"Fetching snapshot proposals for max GIP: {max_gip}")
    url = 'https://hub.snapshot.org/graphql'
    payload = {
        "operationName": "Proposals",
        "variables": {
            "first": max_gip,
            "skip": 0,
            "space_in": ["gnosis.eth"],
            "state": "all",
            "title_contains": "",
            "flagged": False
        },
        "query": """query Proposals($first: Int!, $skip: Int!, $state: String!, $space: String, $space_in: [String], $author_in: [String], $title_contains: String, $space_verified: Boolean, $flagged: Boolean) {
            proposals(first: $first, skip: $skip, where: {space: $space, state: $state, space_in: $space_in, author_in: $author_in, title_contains: $title_contains, space_verified: $space_verified, flagged: $flagged}) {
                id
                title
                body
                start
                end
                state
                author
                created
                choices
                scores_state
                scores_total
                scores
                votes
                quorum
            }
        }"""
    }
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        proposals = response.json()['data']['proposals']
        logger.info(f"Fetched {len(proposals)} proposals from Snapshot")
        return proposals
    except Exception as e:
        logger.error(f"Error fetching snapshot proposals: {str(e)}")
        return []

def extract_and_clean_gip_number(title):
    match = re.search(r'GIP[- ]?(\d+)', title, re.IGNORECASE)
    if match:
        clean_title = re.sub(r'\s*GIP[- ]?\d+:\s*', '', title, flags=re.IGNORECASE)
        return match.group(1), clean_title
    return None, title

def integrate_missing_proposals(missing_gips, forum_topics):
    missing_proposals = []
    for topic in forum_topics:
        slug = topic['slug']
        match = re.search(r'GIP-?(\d+)', slug, re.IGNORECASE)
        if match and int(match.group(1)) in missing_gips:
            url = f'https://forum.gnosis.io/t/{slug}'
            html_content = fetch_html_content(url)
            if html_content:
                full_content, meta_content, title_content, unix_timestamp, discourse_tags = parse_html_content(html_content)
                proposal_info = extract_info_from_meta(meta_content)
                proposal = create_proposal_dict(slug, int(match.group(1)), title_content, full_content, unix_timestamp, discourse_tags, proposal_info)
                missing_proposals.append(proposal)
    return missing_proposals

def create_proposal_dict(slug, gip_number, title, body, start, state, proposal_info):
    funding_info = extract_funding_info(body)
    return {
        'id': slug,
        'gip_number': gip_number,
        'title': title,
        'body': body,
        'start': start,
        'end': None,
        'state': state,
        'author': proposal_info['author'],
        'choices': ['For', 'Against', 'Abstain'],
        'scores_state': None,
        'scores_total': None,
        'scores': [0, 0, 0],
        'votes': None,
        'quorum': None,
        'funding': funding_info
    }

def create_yaml_content(proposal):
    scores = proposal['scores']
    if len(scores) == 2:
        scores.append(0)
    return {
        'id': proposal['id'],
        'gip_number': proposal['gip_number'],
        'url': f'https://forum.gnosis.io/t/{proposal["id"]}' if proposal["id"][:3]=='gip' else f'https://snapshot.org/#/gnosis.eth/proposal/{proposal["id"]}',
        'title': proposal['title'],
        'body': proposal['body'],
        'start': proposal['start'],
        'end': proposal['end'],
        'state': proposal['state'],
        'author': proposal['author'],
        'choices': ['For', 'Against', 'Abstain'],
        'scores_state': proposal['scores_state'],
        'scores_total': proposal['scores_total'],
        'scores': scores,
        'votes': proposal['votes'],
        'quorum': proposal['quorum'],
        'funding': proposal.get('funding', {'amount': None, 'currency': None, 'confidence': None})
    }

def save_proposal_as_yaml(proposal, gip_tracker):
    gip_number = proposal['gip_number']
    start = proposal.get('start', 0)
    
    if gip_number:
        if gip_number in gip_tracker:
            max_start, file_id = gip_tracker[gip_number]
            if start > max_start:
                gip_tracker[gip_number] = (start, file_id + 1)
                file_suffix = ""
                old_file_name = f"./public/GIPs/GIP-{gip_number}.yml"
                new_file_name = f"./public/GIPs/GIP-{gip_number}-redo{file_id}.yml"
                if os.path.exists(old_file_name):
                    os.rename(old_file_name, new_file_name)
            else:
                file_suffix = f"-redo{file_id + 1}"
        else:
            gip_tracker[gip_number] = (start, 0)
            file_suffix = ""
    else:
        file_suffix = "-unknown"

    yaml_content = create_yaml_content(proposal)
    file_name = f"./public/GIPs/GIP-{gip_number}{file_suffix}.yml"
    os.makedirs(os.path.dirname(file_name), exist_ok=True)
    
    with open(file_name, 'w') as file:
        yaml.dump(yaml_content, file, Dumper=CustomDumper, allow_unicode=True, sort_keys=False)

def main():
    try:
        logger.info("Starting GIP scraping process")
        
        # Use the new API-based method
        max_gip, forum_topics = fetch_forum_gips_via_api()
        
        if max_gip == 0:
            logger.error("Failed to fetch GIPs from forum. Exiting.")
            return

        proposals = fetch_snapshot_proposals(max_gip)
        if not proposals:
            logger.error("Failed to fetch proposals from Snapshot. Exiting.")
            return

        processed_proposals = []
        for i, proposal in enumerate(proposals):
            try:
                gip_number, clean_title = extract_and_clean_gip_number(proposal['title'])
                proposal['gip_number'] = gip_number
                proposal['title'] = clean_title
                proposal['funding'] = extract_funding_info(proposal['body'])
                processed_proposals.append(proposal)
                logger.info(f"Processed proposal {i+1}/{len(proposals)}: GIP-{gip_number}")
            except Exception as e:
                logger.error(f"Error processing proposal {proposal.get('id', 'Unknown')}: {str(e)}")

        processed_proposals = sorted(processed_proposals, key=lambda p: p['created'])
        
        gip_numbers_from_api = {int(p['gip_number']) for p in processed_proposals if p['gip_number']}
        missing_gips = set(range(1, max_gip + 1)) - gip_numbers_from_api
        
        additional_proposals = integrate_missing_proposals(missing_gips, forum_topics)
        processed_proposals.extend(additional_proposals)
        
        gip_tracker = {}
        for proposal in processed_proposals:
            try:
                save_proposal_as_yaml(proposal, gip_tracker)
            except Exception as e:
                logger.error(f"Error saving proposal {proposal.get('gip_number', 'Unknown')}: {str(e)}")
        
        logger.info(f"Generated {len(processed_proposals)} YAML files.")
    except Exception as e:
        logger.error(f"An error occurred in main: {str(e)}")

if __name__ == "__main__":
    main()
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

# Create a rate limiter for 15 calls per 60 seconds
rate_limiter = RateLimiter(max_calls=15, period=60)

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
            'model_used': 'gemini-1.5-flash'
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
        dt_obj = datetime.strptime(datetime_value, "%Y-%-%dT%H:%M:%SZ")
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

def scrape_forum_topic_list():
    """
    Scrape the HTML version of the forum topics list.
    This is a last resort when API and RSS are blocked.
    """
    logger.info("Attempting to scrape forum HTML directly")
    max_gip = 0
    topics = []
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
    }
    
    session = create_session_with_retries()
    
    try:
        # Try to scrape the HTML version of the forum
        url = "https://forum.gnosis.io/c/dao/gips/20"
        logger.info(f"Scraping HTML from: {url}")
        
        time.sleep(1)  # Be respectful
        
        response = session.get(url, headers=headers, timeout=30, allow_redirects=True)
        
        if response.status_code != 200:
            logger.error(f"Failed to fetch forum HTML: status {response.status_code}")
            return 0, []
        
        # Check if we got a CAPTCHA or blocked page
        if 'captcha' in response.text.lower() or 'human verification' in response.text.lower():
            logger.error("Got CAPTCHA/verification page")
            return 0, []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all topic links in the forum
        # Discourse uses specific CSS classes for topic listings
        topic_links = soup.find_all('a', class_='title')
        
        if not topic_links:
            # Try alternative selectors
            topic_links = soup.find_all('a', href=re.compile(r'/t/gip-\d+'))
        
        for link in topic_links:
            href = link.get('href', '')
            title = link.get_text(strip=True)
            
            # Extract slug from href
            if '/t/' in href:
                slug = href.split('/t/')[-1].split('/')[0]
                
                topics.append({
                    'slug': slug,
                    'title': title
                })
                
                # Extract GIP number
                m = re.search(r'GIP-?(\d+)', slug, re.IGNORECASE)
                if m:
                    max_gip = max(max_gip, int(m.group(1)))
        
        logger.info(f"Scraped {len(topics)} topics from HTML, max GIP: {max_gip}")
        return max_gip, topics
        
    except Exception as e:
        logger.error(f"Error scraping forum HTML: {str(e)}")
        return 0, []
    finally:
        session.close()

def fetch_all_gip_numbers_from_forum():
    """
    Try to get GIP numbers by directly constructing URLs based on a reasonable range.
    This is the most reliable fallback when the forum blocks all listing methods.
    """
    logger.info("Using fallback: attempting to fetch individual GIP pages")
    
    # Start with a reasonable max based on your last successful run
    # You mentioned GIP-138, so let's check up to 150 to be safe
    estimated_max = 150
    found_gips = []
    max_gip = 0
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    
    session = create_session_with_retries()
    
    try:
        # Check which GIPs exist by trying to fetch them
        for gip_num in range(1, estimated_max + 1):
            # Try common slug patterns
            possible_slugs = [
                f"gip-{gip_num}",
                f"gip-{gip_num}-should",
                f"should-gip-{gip_num}",
            ]
            
            for slug in possible_slugs:
                url = f"https://forum.gnosis.io/t/{slug}"
                
                try:
                    # Use HEAD request to check if page exists (faster)
                    response = session.head(url, headers=headers, timeout=10, allow_redirects=True)
                    
                    if response.status_code == 200:
                        logger.info(f"Found GIP-{gip_num} at {slug}")
                        found_gips.append({
                            'slug': slug,
                            'title': f'GIP-{gip_num}'
                        })
                        max_gip = max(max_gip, gip_num)
                        break  # Found it, no need to try other slug patterns
                        
                except requests.RequestException:
                    continue  # Try next slug pattern
                
                time.sleep(0.3)  # Be respectful with rate limiting
            
            # Every 10 GIPs, log progress
            if gip_num % 10 == 0:
                logger.info(f"Checked up to GIP-{gip_num}, found {len(found_gips)} so far")
        
        logger.info(f"Found {len(found_gips)} GIPs via direct checking, max: {max_gip}")
        return max_gip, found_gips
        
    except Exception as e:
        logger.error(f"Error in fallback GIP fetching: {str(e)}")
        # If even this fails, return a conservative estimate
        return 140, []  # Based on your local run showing GIP-138
    finally:
        session.close()

def fetch_snapshot_proposals(max_gip):
    logger.info(f"Fetching snapshot proposals for max GIP: {max_gip}")
    
    # Add some buffer to max_gip to ensure we get all proposals
    fetch_count = max(max_gip + 20, 150)
    
    url = 'https://hub.snapshot.org/graphql'
    payload = {
        "operationName": "Proposals",
        "variables": {
            "first": fetch_count,
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
        
        # Extract max GIP from Snapshot if forum failed
        snapshot_max_gip = 0
        for proposal in proposals:
            match = re.search(r'GIP[- ]?(\d+)', proposal['title'], re.IGNORECASE)
            if match:
                snapshot_max_gip = max(snapshot_max_gip, int(match.group(1)))
        
        if snapshot_max_gip > max_gip:
            logger.info(f"Snapshot has higher GIP number: {snapshot_max_gip} vs forum: {max_gip}")
            max_gip = snapshot_max_gip
        
        return proposals, max_gip
    except Exception as e:
        logger.error(f"Error fetching snapshot proposals: {str(e)}")
        return [], max_gip

def extract_and_clean_gip_number(title):
    match = re.search(r'GIP[- ]?(\d+)', title, re.IGNORECASE)
    if match:
        clean_title = re.sub(r'\s*GIP[- ]?\d+:\s*', '', title, flags=re.IGNORECASE)
        return match.group(1), clean_title
    return None, title

def integrate_missing_proposals(missing_gips, forum_topics):
    """
    For GIPs that are in the forum but not in Snapshot,
    fetch them directly from the forum.
    """
    missing_proposals = []
    
    logger.info(f"Found {len(missing_gips)} GIPs missing from Snapshot: {sorted(missing_gips)}")
    
    for gip_num in sorted(missing_gips):
        # Try to find this GIP in forum_topics first
        found_topic = None
        for topic in forum_topics:
            if re.search(rf'GIP-?{gip_num}\b', topic['slug'], re.IGNORECASE):
                found_topic = topic
                break
        
        if found_topic:
            slug = found_topic['slug']
        else:
            # If not in topics list, try common slug patterns
            slug = f"gip-{gip_num}"
        
        url = f'https://forum.gnosis.io/t/{slug}'
        logger.info(f"Fetching missing GIP-{gip_num} from {url}")
        
        html_content = fetch_html_content(url)
        if html_content and 'captcha' not in html_content.lower():
            try:
                full_content, meta_content, title_content, unix_timestamp, discourse_tags = parse_html_content(html_content)
                proposal_info = extract_info_from_meta(meta_content)
                proposal = create_proposal_dict(slug, gip_num, title_content, full_content, unix_timestamp, discourse_tags, proposal_info)
                missing_proposals.append(proposal)
                logger.info(f"Successfully fetched GIP-{gip_num}")
            except Exception as e:
                logger.error(f"Error parsing GIP-{gip_num}: {str(e)}")
        else:
            logger.warning(f"Could not fetch content for GIP-{gip_num}")
        
        time.sleep(1)  # Be respectful with rate limiting
    
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
        'author': proposal_info.get('author'),
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
        
        # Try multiple methods to get forum data, in order of preference
        max_gip = 0
        forum_topics = []
        
        # Method 1: Try HTML scraping
        logger.info("Attempting Method 1: HTML scraping")
        max_gip, forum_topics = scrape_forum_topic_list()
        
        # Method 2: If HTML scraping fails, try direct URL checking
        if max_gip == 0:
            logger.info("Method 1 failed. Attempting Method 2: Direct URL checking")
            max_gip, forum_topics = fetch_all_gip_numbers_from_forum()
        
        # Method 3: If both fail, use Snapshot to determine max GIP
        if max_gip == 0:
            logger.warning("Both forum methods failed. Will rely on Snapshot data.")
            max_gip = 140  # Conservative estimate based on your local run
        
        logger.info(f"Determined max GIP: {max_gip}")
        
        # Fetch from Snapshot (this works reliably)
        proposals, updated_max_gip = fetch_snapshot_proposals(max_gip)
        max_gip = updated_max_gip  # Use the higher value
        
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
        
        # Find missing GIPs
        gip_numbers_from_api = {int(p['gip_number']) for p in processed_proposals if p['gip_number']}
        missing_gips = set(range(1, max_gip + 1)) - gip_numbers_from_api
        
        if missing_gips:
            logger.info(f"Attempting to fetch {len(missing_gips)} missing GIPs from forum")
            additional_proposals = integrate_missing_proposals(missing_gips, forum_topics)
            processed_proposals.extend(additional_proposals)
            logger.info(f"Successfully fetched {len(additional_proposals)} missing proposals")
        
        # Save all proposals
        gip_tracker = {}
        for proposal in processed_proposals:
            try:
                save_proposal_as_yaml(proposal, gip_tracker)
            except Exception as e:
                logger.error(f"Error saving proposal {proposal.get('gip_number', 'Unknown')}: {str(e)}")
        
        logger.info(f"Generated {len(processed_proposals)} YAML files.")
        logger.info("Scraping process completed successfully!")
        
    except Exception as e:
        logger.error(f"An error occurred in main: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    main()
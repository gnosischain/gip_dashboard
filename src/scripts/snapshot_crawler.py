import requests
import yaml
import re
import os
from bs4 import BeautifulSoup
import html2text

print("Current working directory:", os.getcwd())

class CustomDumper(yaml.SafeDumper):
    def increase_indent(self, flow=False, indentless=False):
        return super(CustomDumper, self).increase_indent(flow, False)


def fetch_html_meta_content(url):
    header = {'User-Agent': 'Mozilla/5.0'}
    res = requests.get(url,headers=header)
    if res.status_code == 200:
        soup = BeautifulSoup(res.text, 'html.parser')
        meta_content = soup.find('meta', attrs={'name': 'description'})['content']

        # Convert the entire HTML to Markdown
        converter = html2text.HTML2Text()
        converter.ignore_links = False  # Convert links to Markdown format
        converter.body_width = 0  # Prevents line-wrapping which can disrupt tables and code blocks
        markdown_text = converter.handle(str(soup))

        return markdown_text, meta_content
    return "", ""

def extract_info_from_meta(content):
    info = {}
    patterns = {
        'gip_number': r'GIP: (\d+)',
        'title': r'title: (.*?)(?:, [a-z]+:|$)',
        'author': r'author: ([^,]+)',
        'state': r'status: (.*?)(?:, [a-z]+:|$)',
        'type': r'type: ([^,]+)',
        'created': r'created: (\d{4}-\d{2}-\d{2})'
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            info[key] = match.group(1).strip()
        else:
            info[key] = None
    return info

def integrate_missing_proposals(missing_gips, forum_topics):
    missing_proposals = []
    for topic in forum_topics:
        slug = topic['slug']
        match = re.search(r'GIP-?(\d+)', slug, re.IGNORECASE)
        if match:
            gip_number = int(match.group(1))
            if gip_number in missing_gips:
                url = f'https://forum.gnosis.io/t/{slug}'
                full_content, meta_content = fetch_html_meta_content(url)
                proposal_info = extract_info_from_meta(meta_content)
                if proposal_info:
                    gip =  proposal_info['gip_number']
                    title = proposal_info['title'] if proposal_info['title'] else slug.split(f'gip-{gip}-')[-1].replace('-',' ')  # Use slug if title is None
                    # Add logic here to create the proposal dictionary based on the extracted info
                    proposal = {
                        'id': slug,
                        'gip_number': gip,
                        'title': title,
                        'body': f'{full_content}',
                        'start': None,
                        'end': None,
                        'state': proposal_info['state'],
                        'author': proposal_info['author'],
                        'choices': ['For', 'Against', 'Abstain'],
                        'scores_state': None,
                        'scores_total': None,
                        'scores': [0,0,0],
                        'votes': None,
                        'quorum': None,
                    }
                    missing_proposals.append(proposal)
    return missing_proposals

# Helper function to fetch maximum GIP number and topics from Gnosis Forum
def fetch_forum_gips(base_url):
    header = {'User-Agent': 'Mozilla/5.0'}
    i = 0
    has_pages = True
    topics = []
    max_gip = 0
    while has_pages:
        url = base_url + f'?page={i}'
        res = requests.get(url, headers=header)
        topic_list = res.json()['topic_list']
        new_topics = topic_list['topics']
        topics.extend(new_topics)
        for topic in new_topics:
            slug = topic['slug']
            match = re.search(r'GIP-?(\d+)', slug, re.IGNORECASE)
            if match:
                gip_number = int(match.group(1))
                max_gip = max(max_gip, gip_number)
        if 'more_topics_url' in topic_list.keys():
            i += 1
        else:
            has_pages = False
    return max_gip, topics

# Fetch maximum GIP number and topics
base_url = 'https://forum.gnosis.io/c/dao/gips/21.json'
max_gip, forum_topics = fetch_forum_gips(base_url)


# URL and payload for the GraphQL request
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
            ipfs
            title
            body
            start
            end
            state
            author
            created
            choices
            space {
                id
                name
                members
                avatar
                symbol
                verified
                turbo
                plugins
            }
            scores_state
            scores_total
            scores
            votes
            quorum
            quorumType
            symbol
            flagged
        }
    }"""
}

# Make the request
response = requests.post(url, json=payload)
proposals = response.json()['data']['proposals']


# Function to extract and remove GIP number from title
def extract_and_clean_gip_number(title):
    match = re.search(r'GIP[- ]?(\d+)', title, re.IGNORECASE)
    if match:
        # Remove the GIP number and any trailing colon and space
        clean_title = re.sub(r'\s*GIP[- ]?\d+:\s*', '', title, flags=re.IGNORECASE)
        return match.group(1), clean_title
    return None, title


# Extract GIP numbers from fetched proposals
gip_numbers_from_api = {int(extract_and_clean_gip_number(p['title'])[0]) for p in proposals if extract_and_clean_gip_number(p['title'])[0]}

# Identify missing GIPs
missing_gips = set(range(1, max_gip + 1)) - gip_numbers_from_api



# Prepare the proposals by extracting initial GIP numbers and cleaning titles
for proposal in proposals:
    gip_number, clean_title = extract_and_clean_gip_number(proposal['title'])
    proposal['gip_number'] = gip_number
    proposal['title'] = clean_title

# Sort proposals by creation date
processed_proposals = sorted(proposals, key=lambda p: p['created'])

additional_proposals = integrate_missing_proposals(missing_gips, forum_topics)
processed_proposals.extend(additional_proposals)

# Track duplicates to handle redo and other repeats
gip_tracker = {}

# Function to create YAML content from a proposal
def create_yaml_content(proposal):
    scores = proposal['scores']
    if len(proposal['scores'])==2:
        scores.append(0)

    return {
        'id': proposal['id'],
        'gip_number': proposal['gip_number'],
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
    }


# Save each proposal as a YAML file
for proposal in processed_proposals:
    gip_number = proposal['gip_number']
    if gip_number:
        file_id = gip_tracker.get(gip_number, 0)
        gip_tracker[gip_number] = file_id + 1
        file_suffix = f"-redo{file_id}" if file_id else ""
    else:
        file_suffix = "-unknown"


    yaml_content = create_yaml_content(proposal)
    file_name = f"./public/GIPs/GIP-{gip_number}{file_suffix}.yml"
    # Ensure the directory exists
    directory = os.path.dirname(file_name)
    if not os.path.exists(directory):
        os.makedirs(directory)

    with open(file_name, 'w') as file:
        yaml.dump(yaml_content, file, Dumper=CustomDumper, allow_unicode=True, sort_keys=False)

print(f"Generated {len(processed_proposals)} YAML files.")
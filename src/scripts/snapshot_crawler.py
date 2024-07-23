import requests
import yaml
import re
import os

print("Current working directory:", os.getcwd())

class CustomDumper(yaml.SafeDumper):
    def increase_indent(self, flow=False, indentless=False):
        return super(CustomDumper, self).increase_indent(flow, False)


# URL and payload for the GraphQL request
url = 'https://hub.snapshot.org/graphql'
payload = {
    "operationName": "Proposals",
    "variables": {
        "first": 1000,
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
    match = re.search(r'GIP-?(\d+)', title, re.IGNORECASE)
    if match:
        # Remove the GIP number and any trailing colon and space
        clean_title = re.sub(r'\s*GIP-?\d+:\s*', '', title, flags=re.IGNORECASE)
        return match.group(1), clean_title
    return None, title

# Prepare the proposals by extracting initial GIP numbers and cleaning titles
for proposal in proposals:
    gip_number, clean_title = extract_and_clean_gip_number(proposal['title'])
    proposal['gip_number'] = gip_number
    proposal['title'] = clean_title

# Sort proposals by creation date
processed_proposals = sorted(proposals, key=lambda p: p['created'])

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
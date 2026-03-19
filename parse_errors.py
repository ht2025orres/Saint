import codecs
import re

try:
    with codecs.open('c:/Saint/final_build.log', 'rb') as f:
        content = f.read().decode('utf-16le', 'ignore')
except:
    with codecs.open('c:/Saint/final_build.log', 'rb') as f:
        content = f.read().decode('utf-8', 'ignore')

# strip ANSI
ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
clean_content = ansi_escape.sub('', content)

errors = []
lines = clean_content.split('\n')
for i, line in enumerate(lines):
    if 'Error: src/' in line or 'error TS' in line:
        errors.append(line.strip())
        # print the next line if it contains code context
        if i + 1 < len(lines) and lines[i+1].strip() != '':
            errors.append("  " + lines[i+1].strip())

print("\n".join(errors))

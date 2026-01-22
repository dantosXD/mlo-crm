#!/usr/bin/env python3
import sys

with open('frontend/src/pages/ClientDetails.tsx', 'r') as f:
    lines = f.readlines()

# Find line with "Progress," and add "Box," after it
for i, line in enumerate(lines):
    if '  Progress,' in line:
        # Insert Box after Progress
        lines.insert(i + 1, '  Box,\n')
        break

# Find line with "from '@mantine/dates';" and add Dropzone import after it
for i, line in enumerate(lines):
    if "from '@mantine/dates';" in line:
        lines.insert(i + 1, "import { Dropzone, FileWithPath } from '@mantine/dropzone';\n")
        break

with open('frontend/src/pages/ClientDetails.tsx', 'w') as f:
    f.writelines(lines)

print("Imports added successfully")

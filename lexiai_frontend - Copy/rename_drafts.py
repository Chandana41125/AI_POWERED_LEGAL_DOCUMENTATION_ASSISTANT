import os
import re

DRAFT_DIR = "static/drafts"

for file in os.listdir(DRAFT_DIR):
    old_path = os.path.join(DRAFT_DIR, file)

    if os.path.isdir(old_path):
        continue

    name, ext = os.path.splitext(file)

    # Remove ANY number anywhere (5, 10, 3)
    clean = re.sub(r"\d+", "", name)

    # Remove "page", "pages", any case
    clean = re.sub(r"(?i)pages?", "", clean)

    # Replace underscores & hyphens with space
    clean = clean.replace("_", " ").replace("-", " ")

    # Remove extra spaces
    clean = re.sub(r"\s+", " ", clean).strip()

    # Title Case
    clean = clean.title()

    # Add DRAFT prefix
    clean = "Draft " + clean

    # Convert to filename style
    new_file = clean.replace(" ", "_") + ext.lower()

    new_path = os.path.join(DRAFT_DIR, new_file)

    os.rename(old_path, new_path)
    print(f"Renamed: {file} -> {new_file}")

print("\n✨ All draft files renamed with NO NUMBERS and CLEAN NAMES!")

import json
import itertools
from pathlib import Path

# Load helper
def load_json(file_path):
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Failed loading {file_path}: {e}")
        return {}

# Save helper
def save_json(data, file_path):
    with open(file_path, "w") as f:
        json.dump(data, f, indent=4)

# Generate combinations
def generate_story_combinations():
    # Load factor files
    base_path = Path("../data/char")
    story_path = Path("../data/story/story.json")

    backgrounds = list(load_json(base_path / "backgrounds.json").keys())
    roles = list(load_json(base_path / "roles.json").keys())
    traits = list(load_json(base_path / "traits.json").keys())
    personas = list(load_json(base_path / "personas.json").keys())
    races = list(load_json(base_path / "races.json").keys())

    existing_stories = load_json(story_path) if story_path.exists() else {}

    all_combos = itertools.product(backgrounds, roles, traits, personas, races)

    for combo in all_combos:
        key = "|".join(combo)
        if key not in existing_stories:
            existing_stories[key] = (
                f"A {combo[3]} {combo[4]} born from the life of '{combo[0]}', "
                f"who became a '{combo[1]}' with the trait of '{combo[2]}'. "
                "Their story is yet to be written."
            )

    save_json(existing_stories, story_path)
    print(f"Generated {len(existing_stories)} total story entries.")

if __name__ == "__main__":
    generate_story_combinations()
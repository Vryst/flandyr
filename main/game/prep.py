


import json

def load_translations(language="en"):
    try:
        with open(f"../translation/{language}.json", "r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"Error: Translation file for '{language}' not found.")
        return None
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in the translation file '{language}.json'.")
        return None



def get_translation(key, translations, *args):
    # If the key exists, format the string with additional arguments
    if key in translations:
        return translations[key].format(*args)
    else:
        print(f"Warning: Translation for '{key}' not found.")
        return key  # Fallback to the key itself
        



        
    
tsl = load_translations()

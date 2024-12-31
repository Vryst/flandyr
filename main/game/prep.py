
import shutil
from time import *
import json
import os
import sys
import random

# Variable Glosarium
MINIMUM_WIDTH = 16
MAXIMUM_WIDTH = 60
STANDARD_WIDTH = 37
user_width = STANDARD_WIDTH
warning = True # switch for refresh_width()
dot = "." # just in case
nl = "\n" #nEW lINE
d = '-' #dASH

lang = {
'en':'English',
'es':'Español',
'fr':'Français',
'gr':'Deutsch',
'ina':'Indonesia',
'jp':'日本語',
'cn':'中国',
'arb':'عربي',
'ind':'भारत'
}

# =========== MAIN METHOD ============

# For clearing view
def clear():
    if os.name == 'nt':
        os.system('cls')
    else:
        os.system('clear')
        

# Refresh width
def refresh_width(debug=False):
    now = shutil.get_terminal_size().columns  # Get current terminal width
    global warning
    
    
    if warning:
        width = now
        while True:  # Loop until a valid response is given
            if width <= MINIMUM_WIDTH:
                c = input("Your\nscreen\nis\ntoo\nsmall,\nProceed?\n(y/n)\n(f = fix)\n: ").strip().lower()
                if c == 'y':
                    warning = False
                    break
                elif c == 'f':
                    print("Please\nset\nyour\nterminal\nwidth\nto, or\nabove\n16pt\nand\nbelow\n36pt", flush=True)
                    input("Press Enter when done...")
                    warning = False
                    break
                    
                elif c == 'n':
                    sys.exit('Thx\nFor\nPlay-\ning!\n:D')
                else:
                    clear()  # Clear screen for invalid input
                    pass
            elif width >= MAXIMUM_WIDTH:
                c = input("Y O U R  S C R E E N  I S  T O O  B I G !\n\nP R O C E E D  ( Y / N / F  T O  F I X) : ").strip().lower()
                if c == 'y':
                    warning = False
                    break
                elif c == 'f':
                    print(f"{'P L E A S E   S E T   Y O U R   T E R M I N A L   W I D T H   E Q U A L  /  A B O V E   1 2 P T   A N D   B E L O W   3 6 P T ':^{width}}", flush=True)
                    input("Press Enter when done...")
                    warning = False
                    break
                elif c == 'n':
                    sys.exit(f"{'T H A N K S   F O R   P L A Y I N G ! ! !   :D':^{width}}")
                else:
                    clear()  # Clear screen for invalid input
            
            else:
                break  # Exit if width is within acceptable bounds
    
    now = shutil.get_terminal_size().columns
    if debug:
        print("Width refreshed to ", now)
    
    return now
    


# Blank input to continue
def confirm():
    dash()
    print(f"{printf(tsl['continue'])}")
    dashn()
    input()
    
    
    
# Open dash
def dash(n=None, r=False, d="="):
    if n is None:
        n = refresh_width()
    if r:
        return d * n
    print(d * n, flush=True)

    
    
# Close dash (with newline)
def dashn(n=None, r=False, d="="):
    if n is None:
        n = refresh_width()
    if r:
        return d * n
    print(d * n, "\n", flush=True)
    
    
    
# Loading animation
def loading(duration=3):
    wide = refresh_width()  # Call once
    end_time = time() + duration

    frames = [
        "⠂⠄⠅","⠇⠆⠘","⠐⠠⠐",
        "⠄⠅⠇","⠆⠘⠐","⠠⠐⠘",
        "⠅⠇⠆","⠘⠐⠠","⠐⠘⠂",
        "⠇⠆⠘","⠐⠠⠐","⠘⠂⠄",
        "⠆⠘⠐","⠠⠐⠘","⠂⠄⠅",
        "⠘⠐⠠","⠐⠘⠂","⠄⠅⠇",
        "⠐⠠⠐","⠘⠂⠄","⠅⠇⠆",
        "⠠⠐⠘","⠂⠄⠅","⠇⠆⠘",
        "⠂⠄⠅","⠇⠆⠘","⠐⠠⠐"
    ]

    while time() < end_time:
        for frame in frames:
            if time() >= end_time:
                break
            sys.stdout.write(f'\r{frame * (wide // 3)}')
            sys.stdout.flush()
            sleep(0.05)
    clear()

        
# printing (prettifier)
# print(index,text) for num list
# printf(text) for plain centered text
def printf(index=None,text="error"):
    if text == False:
       
        dash()
        print("This is a function i built because i get sick of repeating long format print :)")
        dashn()
        
    elif index:
        if type(index) == str:
            return f"{f'{index}':^{refresh_width()}}"
        return f"{f'{dash(20,1,d):^{refresh_width()}}{nl}':^{refresh_width()}}\r{f'|{index} {text:<16}|':^{refresh_width()}}{nl}{dash(20,1,d):^{refresh_width()}}"
        
    else:
        dash()
        print("ERROR PRINTING, ARGS = ",text)
        dashn()
        
        
#loop printf
def printl(*text):
    n = 1
    for i in text:
        
        print(f"{printf(n,i)}")
        n += 1
        
# ====== TRANSLATION FUNCTION =====
def load_translations(language="en"):
    try:
        with open(f"../translation/{language}.json", "r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"Error: Translation file for '{language}' not found.")
        return None
    except json.JSONDecodeError as e:
        
        print(e)
        print(f"Error: Invalid JSON in the translation file '{language}.json'.")
        return None



def get_translation(key, translations, *args):
    # If the key exists, format the string with additional arguments
    if key in translations:
        return translations[key].format(*args)
    else:
        print(f"Warning: Translation for '{key}' not found.")
        return key  # Fallback to the key itself
        


def choose_language(default="en",debug=False):
    # Language selection
    lang_list = [i.split(dot)[0] for i in os.listdir("../translation/") if i.endswith(".json")]
    
    tsl = load_translations()
    
    if debug:
        return tsl
        
    while True:
        clear()
        index = 1
        
        dash()
        print(f"{printf('LANGUAGE')}")
        dashn()
        
        for i in lang_list:
            
            if i in lang.keys():
                print(f"{printf(index,lang[i])}")
                index +=1
                
            else:
                dash()
                print(f"{printf('NO TRANSLATE FOUND')}")
                dashn()
                
                pass
                
        try:
            language_choice = int(input(f"\n{printf(tsl['chooselang'])} "))
            if language_choice <= 0 or language_choice > len(lang_list):
                dash()
                print(f"{printf(tsl['invalid'])}")
                dashn()
                
                loading(1)
            else:
                choosed = lang_list[language_choice - 1]
                tsl = load_translations(choosed)
                
                dash()
                print(f"{printf(tsl['langs'])}{printf(lang[choosed])}")
                dashn()
                loading(1)
                
                return tsl
                
                break
        except ValueError:
            
            dash()
            print(f"{printf(tsl['invalidnum'])}")
            dashn()
            
            loading(1)
        
    

tsl = choose_language(debug=1)
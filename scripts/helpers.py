import os
import json
import shutil
import sys
import time

# ========= CONFIG =========
MINIMUM_WIDTH = 16
MAXIMUM_WIDTH = 72
STANDARD_WIDTH = 37
user_width = STANDARD_WIDTH
warning = True
dot = "."
nl = "\n"
d = "-"

# Available language names
lang = {
    'en': 'English',
    'es': 'Español',
    'fr': 'Français',
    'gr': 'Deutsch',
    'ina': 'Indonesia',
    'jp': '日本語',
    'cn': '中国',
    'arb': 'عربي',
    'ind': 'भारत'
}

# ========= DISPLAY =========

def clear():
    os.system('cls' if os.name == 'nt' else 'clear')

def sleep(delay):
    time.sleep(delay)
    
def confirm(translate=1):
    dash()
    if translate != 1:
        print(printf(translate.get('continue', 'Press any key to continue')))
        
    print(printf("Enter anything to continue"))
    dashn()
    input()
    
def refresh_width(debug=False):
    now = shutil.get_terminal_size().columns
    global warning

    if warning:
        width = now
        while True:
            if width <= MINIMUM_WIDTH:
                c = input("Your\nscreen\nis\ntoo\nsmall,\nProceed?\n(y/n)\n(f = fix)\n: ").strip().lower()
                if c == 'y':
                    warning = False
                    break
                elif c == 'f':
                    print("Please set your terminal width to 16–60 characters.")
                    input("Press Enter when done...")
                    warning = False
                    break
                elif c == 'n':
                    sys.exit("Thanks for playing!")
                else:
                    clear()
            elif width > MAXIMUM_WIDTH:
                c = input("Screen too wide! Proceed (y/n/f to fix): ").strip().lower()
                if c == 'y':
                    warning = False
                    break
                elif c == 'f':
                    print("Please set terminal width between 16 and 60 characters.")
                    input("Press Enter when done...")
                    warning = False
                    break
                elif c == 'n':
                    sys.exit("Thanks for playing!")
                else:
                    clear()
            else:
                break

    now = shutil.get_terminal_size().columns
    if debug:
        print("Width refreshed:", now)

    return now

def dash(n=None, r=False, d="="):
    if n is None:
        n = refresh_width()
    if r:
        return d * n
    print(d * n, flush=True)

def dashn(n=None, r=False, d="="):
    if n is None:
        n = refresh_width()
    if r:
        return d * n
    print(d * n, "\n", flush=True)

def loading(duration=3):
    wide = refresh_width()
    end_time = time.time() + duration
    frames = [
        "⠂⠄⠅","⠇⠆⠘","⠐⠠⠐",
        "⠄⠅⠇","⠆⠘⠐","⠠⠐⠘",
        "⠅⠇⠆","⠘⠐⠠","⠐⠘⠂"
    ]
    while time.time() < end_time:
        for frame in frames:
            if time.time() >= end_time:
                break
            sys.stdout.write(f'\r{frame * (wide // 3)}')
            sys.stdout.flush()
            sleep(0.05)
    clear()

def printf(index=None, text="error"):
    screen = refresh_width()
    
    
    if text is False:
        dash()
        print("This is a function I built to avoid repeating print formatting.")
        dashn()
    elif index:
        if isinstance(index, str):
            return f"{index:^{screen}}"
        dash_line = dash(29, 1, d)
        text_line = f'|{index:>2} {text:<24}|'
        dash_footer = dash(29, 1, d)

        return f"{dash_line:^{screen}}\n{text_line:^{screen}}\n{dash_footer:^{screen}}"
    else:
        dash()
        print("ERROR PRINTING:", text)
        dashn()


def printt(list):
    list = [i.title() for i in list]
    for i, t in enumerate(list, 1):
            print(printf(i, t))
            
            
def open_json(path):
    dict = None
    keys = []
    with open(path, "r") as file:
        dict = json.load(file)
        for i in dict.keys():
            keys.append(i)
            
    return dict,keys


def confirm_choose(message="You sure? (y/n): "):
    confirm = str(input(message)).lower()
    
    return confirm
    
    
# ===== JSON =====
def open_desc(json):
    effects = [*json["buff"],*json["debuff"]]
    while True:
        clear()
        
        print("Which effect you wish to know about")
        dash()
        printt(effects)
        
        try:
            choose = int(input("Input the index (0 to go back): "))
            if choose < 0 or choose > len(effects):
                error("Index beyond limit")
                
        except Exception as e:
            error("Please input a valid number")
            continue
        match choose:
            case 0:
                break
        
#EXAMPLE:
#data = load_json_file(path)
#data output = {"dummy":"dummy"}
def load_json_file(path):
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception as e:
        error(f"Failed to load {path}: {e}")
        return {}
        
def choose_from_json(path, prompt):
    try:
        f, options = open_json(path)
    except Exception as e:
        dash()
        fade_in("Failed to load JSON file")
        print("Reason:\n",e)
        return None

    while True:
        clear()
        dash()
        print(printf(prompt))
        printt(options)
        dashn()

        try:
            choice = int(input(": "))
        except Exception as e:
            print(e)
            fade_in_out("Please input a number, CODE: NUM-001", 0.01, 0.5, 0.01)
            continue

        if 0 <= choice - 1 < len(options):
            dash()
            choosen = f[options[choice - 1]]
            
            print(printf(options[choice - 1].title()))
            print(printf(choosen["desc"]))
            
            
            if "buff" in choosen.keys():
                
                print(f"\nBuff:")
                if choosen["buff"] != []:
                    for buff in choosen['buff']:
                        print(f"{' '*4}-{buff.title()}")
                else:
                    print(f"{' '*4}-None")
                    
                print(f"\nDebuff:")
                if choosen["debuff"] != []:
                    for debuff in choosen['debuff']:
                        print(f"{' '*4}-{debuff.title()}")
                else:
                    print(f"{' '*4}-None")
                    
                dashn(d="-")
                confirm = confirm_choose(f"Input 0 to read the buff/debuff description.\n\nOtherwise, continue? (y/n): ")
            
            #if there is no buff of debuff available (eg. Class/Role)
            else:
                dash()
                confirm = confirm_choose(f"You choose the {options[choice - 1]}, proceed? (y/n): ")
            
            if confirm == "0":
                open_desc(choosen)
            elif confirm == "y":
                return options[choice - 1]
            elif confirm == "n":
                continue
            else:
                error("The choice beyond limit, CODE: LMT-001")
                continue
        else:
            error("Choice index out of range, CODE: OOR-001")
            continue
            

def error(message):
    dash()
    fade_in_out(message,0.01,1,0.01)
    
    
def fade_in_out(text, type_delay=0.05, hold=0.5, fade_delay=0.05):
    # Fade In (mesin ketik)
    for char in text:
        sys.stdout.write(char)
        sys.stdout.flush()
        time.sleep(type_delay)
    
    # Tahan teks sebentar
    time.sleep(hold)

    # Fade Out (hapus satu per satu)
    for _ in text:
        sys.stdout.write('\b \b')  # Hapus karakter dari belakang
        sys.stdout.flush()
        time.sleep(fade_delay)
        
def cinematic_print(text):
    
    n = 0
    for i in text:
        clear()
        dash()
        sys.stdout.write(text[0:n+1].center(refresh_width()))
        n+=1
        dashn()
        sleep(0.01)
        
        
def fade_in(text, delay=0.05):
    for char in text:
        sys.stdout.write(char)
        sys.stdout.flush()
        time.sleep(delay)
    print()

def fade_out(text, delay=0.05):
    sys.stdout.write(text)
    sys.stdout.flush()
    time.sleep(0.5)
    for i in range(len(text)):
        sys.stdout.write('\b \b')  # Backspace + replace with space + backspace
        sys.stdout.flush()
        time.sleep(delay)
        
    
#fade_in_out("Halo, ini efek fade-in dan fade-out!", type_delay=0.05, hold=1, fade_delay=0.03)

#lines = ["Selamat datang,", "Di dunia terminal.", "Bersiaplah."]
#for line in lines:
#    fade_in_out(line, type_delay=0.05, hold=1, fade_delay=0.03)


# ========= TRANSLATION =========

def load_translations(language="en"):
    try:
        with open(f"data/language/{language}.json", "r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"Error: Translation file for '{language}' not found.")
    except json.JSONDecodeError as e:
        print(f"Error in '{language}.json': {e}")
    return {}

def choose_language(default="en", debug=False):
    lang_files = [f for f in os.listdir("data/language/") if f.endswith(".json")]
    lang_list = [f.split(dot)[0] for f in lang_files]

    if not lang_list:
        sys.exit("No language files found.")

    translate = load_translations(default)

    if debug:
        return translate

    while True:
        clear()
        dash()
        print(printf("LANGUAGE"))
        dashn()

        for i, code in enumerate(lang_list, 1):
            lang_name = lang.get(code, f"Unknown ({code})")
            print(printf(i, lang_name))

        try:
            choice = int(input(f"\n{printf(translate.get('chooselang', 'Choose language'))} "))
            if 1 <= choice <= len(lang_list):
                selected = lang_list[choice - 1]
                translate = load_translations(selected)

                dash()
                print(printf(translate.get('langs', 'Selected Language')))
                print(printf(lang.get(selected, selected)))
                dashn()
                loading(1)

                return translate
            else:
                raise ValueError
        except ValueError:
            dash()
            print(printf(translate.get('invalidnum', 'Invalid input. Try again.')))
            dashn()
            loading(1)

# ====== USAGE ======
if __name__ == "__main__":
    
    translate = choose_language()
    
    
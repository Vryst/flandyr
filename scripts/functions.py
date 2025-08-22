

from .characters import *
from .helpers import *

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
        
menu = ["New Game", "Load Game", "Help", "Exit"]

#THIS FUNC JUST DO AS ITS NAME
def intro(translate="en"):
    clear()
    for i in ["Game by: Vryst","...","Presenting to you","||||| Flandyr |||||"]:
        cinematic_print(i)
        sleep(1)
    
#TODO: Story not yet created
def story(translate="en"):
    fade_in_out("The world shall remember your name...",0.03,2,0.01)
    clear()
    
    read = confirm_choose("Read story? (y/n): ")
    read = read.lower()
    match read:
        case "y":
            pass
        case "n":
            return 0
                
    try:
        with open("data/story/mainStory.json","r") as f:
            file = json.load(f)
            for line in file:
                print(line)
                
    except:
        print(printf("Not available"))
        confirm()
        clear()
        
    

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
            

def choose_name(): 
    cinematic_print(printf("Carve your name into the history"))
    name: str = input(": ")
    return name

def choose_race():
    return choose_from_json("data/char/races.json","You're a...")
def choose_background():
    return choose_from_json("data/char/backgrounds.json", "The past that shapes you is...")

def choose_role():
    return choose_from_json("data/char/roles.json", "Pick your first role")

def choose_traits():
    return choose_from_json("data/char/traits.json", "Which trait defines you")
            
            
def pickBuff(player,attribute):
    
    
    if attribute == "backgrounds":
        key = player.background
    elif attribute == "races":
        key = player.race
    elif attribute == "traits":
        key = player.trait
        
    with open(f"data/char/{attribute}.json","r") as f:
       file = json.load(f)
        
    
    for k,v in file.items():
        if k == key:
            player.buff += v["buff"]
            
            
def new_game():
    name = choose_name()
    race = choose_race()
    background = choose_background() 
    role = choose_role()
    trait = choose_traits()
    skills = load_json_file("data/char/abilities.json")
    
    player = Character(
        name=name,
        race=race,
        background=background,
        role=role,
        trait=trait,
        stat=load_json_file("data/char/roles.json")[role]["stats"],
        skill=list(skills[role].keys()) if role in skills else [],
        skill_dict=skills
    )
    
    
    clear()
    cinematic_print("Character Information")
    
    print(f"""
NAME: {player.name.title()}
RACE: {player.race.title()}
BACKGROUND: {player.background.title()}
CLASS: {player.role.title()}
TRAIT: {player.trait.title()}
    """)
    
    dash()
    print(printf("STATS"))
    dashn()
    for k,v in player.stats.items():
        multiply = 4
        k = k.replace("_"," ").upper()
        if "max" in k:
            multiply = 1
        space = " "*multiply
        
        v_text = f"{v}"
        fade_in(f"{space}{k} : {v_text}",0.010)
        
    pickBuff(player,"races")
    pickBuff(player,"backgrounds")
    pickBuff(player,"traits")
    
    dash()
    print(printf("SKILL"))
    dashn()
    
    player.print_skills()
    
    
    
        #try:
#            choice = int(input(": "))
#        except:
#            fade_in(f"input error: ({choice})",0.01)
#            fade_in_out("Please input a number, CODE: NUM-002",0.01,1,0.01)
        
def main_menu(translate="en"):
    while True:
        clear()
        dash()
        print(printf("MAIN MENU"))
        for i, t in enumerate(menu, 1):
            print(printf(i, t))
        dashn()

        try:
            io = int(input("\n\n: "))
            match io:
                case 1:
                    new_game()
                    return
                    
                case 2:
                    fade_in_out("Load feature not implemented yet", 0.01, 1, 0.01)
                    
                case 3:
                    help()
                    clear()
                    
                case 4:
                    print(printf("Goodbye."))
                    loading(1)
                    break
                    
                case _:
                    error("Unknown option., CODE: UNK-001")
                    pass
                    
        except Exception as e:
            print(e)
            error("Please input a valid number, CODE: NUM-003")
            
            
def main():
    #intro()
    main_menu()
    
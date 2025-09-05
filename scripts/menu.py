from .helpers import *
from .functions import *
from .models.entities import *


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
    
        
menu = ["New Game", "Load Game", "Help", "Exit"]
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
            
            
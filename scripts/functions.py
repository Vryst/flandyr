from .helpers import *


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
            

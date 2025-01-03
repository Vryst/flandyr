from game.classes import *
from game.fun import *
from game.prep import *


# Start a new game
def new_game():
    
    dash()
    print(f"{printf(tsl['new'])}")
    dashn()
    loading(1)
    
    dash()
    print(f"{printf(tsl['success'])}")
    dashn()
    loading(1)
    
    main(translate=tsl)

# Load an existing game
def load_game(filename):
    
    dash()
    print(f"{printf(tsl['loads'])}{printf(filename.split(dot)[0])}")
    dashn()
    
    loading(1)

    try:
        path = f"playerData/{filename}"
        with open(path, 'r') as file:
            dash()
            print(f"{printf(tsl['successload'])}")
            dashn()
            
            loading(1)
            main(path)
            loading(1)
    except Exception as e:
        print(e)

# Display the main menu
def show_main_menu():
    while True:
        clear()
        
        dash()
        print(f"{printf('MAIN MENU')}")
        dashn()
        
        print(f"{printf(1,tsl['startnew'])}")
        print(f"{printf(2,tsl['startload'])}")
        print(f"{printf(3,tsl['exit'])}")

        choice = input(f"\n{tsl['option']}: ")
        if choice == "1":
            new_game()
            break
        elif choice == "2":
            while True:
                clear()
                
                dash()
                print(f"{printf(tsl['chooseload'])}")
                dashn()
                
                json_files = [f for f in os.listdir("playerData") if f.endswith('.json')]

                if json_files:
                    for idx, file in enumerate(json_files, 1):
                        #print(f"{f'|{idx}. {file.split(dot)[0]:<16}|':^{refresh_width()}}")
                        print(f"{printf(idx,file.split(dot)[0])}")
                    try:
                        file_choice = int(input(f"\n\n{printf(tsl['indexload'])}: "))
                        
                        if file_choice == 0:
                            break
                        file_choice -= 1
                        if 0 <= file_choice < len(json_files):
                            load_game(json_files[file_choice])
                            print('error')
                            confirm()
                            break
                        else:
                            dash()
                            print(f"{printf(tsl['invalid'])}")
                            dashn()
                            loading(0.5)
                            
                    except ValueError:
                        dash()
                        print(f"{printf(tsl['invalidnum'])}")
                        dashn()
                        loading(0.5)
                else:
                    dash()
                    print(f"{printf(tsl['nosave'])}")
                    dashn()
                    loading(0.5)
        elif choice == "3":
            dash()
            print(f"{printf(tsl['exits'])}")
            dashn()
            loading(0.3)
            
            
            sys.exit(f"{printf(tsl['quit'])}")
        else:
            dash()
            print(f"{printf(tsl['invalid'])}")
            dashn()
            loading(0.5)

# Main execution
if __name__ == "__main__":
    tsl = choose_language() #choosing language when starting the game
    
    if tsl:
        show_main_menu()
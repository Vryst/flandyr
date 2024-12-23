
from classes import *
from fun import *
from prep import *


 

def new_game():
    
    print(f"{tsl['new']}")
    loading(1)
    
    print(f"{tsl['success']}")
    loading(1)
    
    main()
    # Your code to start the new game

def load_game(filename):
    print(f"{tsl['loads']}{filename}")
    loading(1)
    
    try:
        path = f"playerData/{filename}"
        
        with open(path, 'r') as file:
            # Assuming the character data is a dictionary and using it to load the game
            print(f"{tsl['successload']}")
            #print(os.listdir(filepath))
            loading(1)
            # Process character data and continue the game
            main(path)
            loading(1)
            
    except Exception as e:
        #print(f"{e}")
        print(e)

def show_main_menu():
    clear()
    
    while True:
        
        print("======== MAIN MENU ========\n")
        
        print(f"1. {tsl['startnew']}")
        print(f"2. {tsl['startload']}")
        print(f"3. {tsl['exit']}")
        
        choice = input(f"\n\n{tsl['option']}")
        
        if choice == "1":
            new_game()  # Start a new game
            break  # Exit the menu after starting the game
        
        elif choice == "2":
            clear()
            print(f"{tsl['chooseload']}")
            # List all JSON files in the current directory
            json_files = [f for f in os.listdir("playerData") if f.endswith('.json')]
            
            if json_files:
                for idx, file in enumerate(json_files, 1):
                    print(f"{idx}. {file}")
                
                try:
                    file_choice = int(input(f"\n{tsl['indexload']}: ")) - 1
                    
                    if 0 <= file_choice < len(json_files):
                        load_game(json_files[file_choice])
                        break  # Exit the menu after loading the game
                    
                    else:
                        print(f"{tsl['invalid']}")
                        loading(0.5)
                        clear()
                
                except ValueError:
                    print(f"{tsl['invalidnum']}")
                    loading(0.5)
            
            else:
                print(f"{tsl['nosave']}")
                loading(0.5)
                
        elif choice == "3":
            print(f"{tsl['exits']}")
            loading(0.3)
            break  # Exit the loop to close the program
        
        else:
            print(f"{tsl['invalid']}")
            loading(0.5)

# Run the menu
if __name__ == "__main__":
    # Main execution
     # Load selected language translations
    
    language_list = [i for i in os.listdir("translation/") if i.endswith(".json")]
    language = []
    for i in language_list:
        text = i.split(".")[0]
        language.append(text)
        
    while True:
        index = 1
        print("========== LANGUAGE ==========\n")
        for i in language:
            if "en" in i:
                print(f"{index:>2}. English")
                index+=1
            elif "es" in i:
                print(f"{index:>2}. Español")
                index+=1
            elif "ina" in i:
                print(f"{index:>2}. Indonesia")
                index+=1
            else:
                break
        try:
            
            language_choice = int(input("\nPlease choose a language: "))
            if language_choice <= 0 or language_choice > len(language_list):
                print(f"{tsl['invalid']}")
                loading(1)
            else:
                choosed = language[language_choice-1]
                tsl = load_translations(choosed)
                print(f"Language picked: {choosed}")
                loading(1)
                break
        except ValueError as e:
            
            print("Please input a number!")
            loading(1)
    if tsl:
        show_main_menu()  # Display the main menu with the loaded translations
   
    

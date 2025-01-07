
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
    print(f"Attempting to load file: {filename}")
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
        print("========Main Menu========")
        print(f"1. {tsl['startnew']}")
        print(f"2. {tsl['startload']}")
        print(f"3. {tsl['exit']}")
        choice = input(f"{tsl['option']}")
        
        if choice == "1":
            new_game()  # Start a new game
            break  # Exit the menu after starting the game
        elif choice == "2":
            print("\nSelect a game to load:")
            # List all JSON files in the current directory
            json_files = [f for f in os.listdir("playerData") if f.endswith('.json')]
            if json_files:
                for idx, file in enumerate(json_files, 1):
                    print(f"{idx}. {file}")
                try:
                    file_choice = int(input("Enter the number of the game to load: ")) - 1
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
    
    if tsl:
        show_main_menu()  # Display the main menu with the loaded translations
   
    
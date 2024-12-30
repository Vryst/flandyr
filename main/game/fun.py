

from game.classes import *

import random


def maintenance():
    print(f"{tsl['maintenance']}")
    loading(1)


# this gonna be the longest function later
def dialogue(player):
    return False
    
    
    
def create_hero(hero_name, hero_class, subroles=[]):
    """
       ("role",
       [subroles],
       HP,
       ATK,
       DEF,
       CRATE,
       CDMG,
       STR,
       VIT,
       AGI,
       INT,
       COIN,
       REPUTATION,
       ,INVENTORY (list)
       )
    """
    
    roles = [
        ("warrior",
        subroles,
        1000,
        130,
        30,
        35,
        80,
        5,
        8,
        15,
        3,
        0,
        0,
        ["sword","light helmet","medium armor","medium legging","leather boots"]),
        
        ("archer",
        subroles,
        700,
        80,
        25,
        50,
        100,
        4,
        2,
        45,
        4,
        0,
        0,
        ["bow","light ranger suit","light legging","swift boots"]),
        
        ("mage",
        subroles,
        400,
        270,
        15,
        10,
        120,
        1,
        2,
        15,
        8,
        0,
        0,
        ["staff","medium robe","light legging","arcane boots"]),
        
        ("assassin",
        subroles,
        450,
        50,
        15,
        75,
        200,
        3,
        4,
        70,
        4,
        0,
        0,
        ["dagger","cloak","light legging","sneak boots"]),
        
        ("cleric",
        subroles,
        500,
        30,
        70,
        10,
        20,
        1,
        3,
        15,
        5,
        0,
        0,
        ["grimoire","light robe","medium legging","medium boots"])
    ]
    
    role, subroles, health, attack, defend, crit_rate, crit_dmg, strength, vitality, agility, intelligence, coin, reputation, inventory = roles[hero_class - 1]
    return Hero(hero_name, role, subroles, health, attack, defend, crit_rate, percent(crit_dmg), strength, vitality, agility, intelligence, coin, reputation, inventory)





def main(load=False,translate=tsl):
    clear()
    
    if load == False:
        hero_name, hero_class = pilih_role(translate)  # Pass directly
        hero = create_hero(hero_name, hero_class)
        
    elif load != False:
        hero = Hero.loadData(load)
        
        dash()
        print(f"{printf('LOADED CHAR')}")
        dashn()
        
        print(hero)
        
        confirm()
        loading(0.5)
    else:
        dash()
        print(f"{printf('NOT FOUND')}")
        dashn()
        raise Exception
        confirm()
    while True:
        encounter(hero,translate)
        
        
        confirm()
    
    

#pilih role
def pilih_role(tsl):
    
    dash()
    print(f"{printf(tsl['welcome'])}")
    dashn()
    
    
    hero_name = str(input(f"{tsl['inputname']}: "))
    while True:
        
        clear()
        try:
            dash()
            for i,role in enumerate(roles,1):
                
                print(f"{printf(i,role)}")
                
            dashn()
            hero_class = int(input(f"{tsl['inputrole']}"))
            
            if hero_class in roles_index:
                break
            else:
                pass
                
        
        
        except:
            print(f"{tsl['errinputrole']}")
            pass
        
        
    return hero_name, hero_class
    
    

def battle(player,enemy,tsl=tsl):
            clear()
            print(f"Kamu bertarung melawan {enemy.name}!\n")
            
            while True:
                
                print(f"{player.name}'s HP: {player.health}")
                print(f"{enemy.name}'s HP: {enemy.health}")
                
                
                try:
                    
                    while True:
                        try:
                            print(f"""
Pilih aksi yang tersedia:
      1. {tsl['encounter']['battle']['atkopt']}
      2. {tsl['encounter']['battle']['guardopt']}
      3. {tsl['encounter']['battle']['itemopt']}
      4. {tsl['encounter']['battle']['runopt']}\n""")
                            aksi_battle = int(input("Pilihan(1/2/3/4): "))
                            if aksi_battle in [1, 2, 3, 4]:
                                break  # Exit the loop if valid input is given
                            else:
                                clear()
                                print(f"{tsl['invalid']}")
                                loading(1)
                        except ValueError:
                            clear()
                            print(f"{tsl['invalidnum']}")
                            loading(1)
        
                    if aksi_battle == 1:
                        player.Attack(enemy,tsl)
                        loading(1)
                        enemy.Attack(player,tsl)
                        loading(1)
                        
                    if aksi_battle == 2:
                        clear()
                        player.Guard(tsl)
                        
                        loading(1)
                        enemy.Attack(player,tsl)
                        loading(1)
                        
                        pass
                        
                    if aksi_battle == 3:
                        clear()
                        
                        while True:
                            
                            try:
                                
                                if not player.inventory:
                                    
                                    dash()
                                    print(f"{printf({tsl['encounter']['battle']['empty']})}")
                                    dashn()
                                    break
                                
                                a = 1
                                for i in player.inventory :
                                    if i in Makanan.buah:
                                        print(f"{printf(a,Makanan.detail_buah[i]['name'])}")
                                        continue
                                    print(f"{printf(a,i)}")
                                    print
                                    a += 1
                                pilih_item = int(input(f"{tsl['encounter']['battle']['itempick']} "))
                                #fungsi_item
                                maintenance()
                                
                                break
                            except ValueError:
                                clear()
                                print(f"{tsl['invalidnum']}")
                                loading(1)
                                
                    if aksi_battle == 4:
                        
                        if enemy.health <= 0:
                            break
                        elif player.health <= 0:
                            break
                        try:
                            kabur = player.Run()
                            if kabur:
                                
                                dash()
                                print("{printf(tsl['encounter']['battle']['escape'])}")
                                dashn()
                                
                                loading(1)
                                break
                            else:
                                print(f"{tsl['encounter']['battle']['escapefail']}")
                                loading(1)
                                clear()
                        except TypeError:
                            print("Easter egg! :D")
                            
                    else:
                        clear()
                        pass
                except ValueError:
                    clear()
                    
                    dash()
                    print(f"{printf(tsl['invalidnum'])}")
                    dashn()
                    
            if player.health <= 0:
                return False
                
            if enemy.health <= 0:
                
                return True
            
            else:
                return "kabur"

#event
def pergi():
    menemukan = random.choice(range(2))
    return 1 if menemukan == 0 else 2
    
    

    
#encounter
def encounter(hero,tsl=tsl):
    
    berjalan = pergi()
    
    
    on = True
    if berjalan == 1:
       while on:
        
        enemy = Enemy(randomizer(musuh),randomizer(roles),randomizer(subroles),randomizer(),randomizer(),randomizer(),randomizer(),percent(randomizer()),randomizer(),randomizer(),randomizer(),randomizer())
        
        #enemy.getStat()
        while True:
            
            clear()
            
            dash()
            print(f"{printf(tsl['encounter']['meet'])}{printf(enemy.name)}")
            dashn()
            
            lanjut = input(f"{tsl['encounter']['battle']['atkopt']} (y/n) : ").lower()
            
            if lanjut == "y":
                  hasil_pertarungan = battle(hero,enemy,tsl)
                  if hasil_pertarungan == "kabur":
                      print(f"{printf(tsl['encounter']['battle']['escape'])}")
                      loading(1)
                      break
                  if hasil_pertarungan == True:
                      print(f"\nKamu mengalahkan {enemy.name}!")
                      loading(1)
                      break
                  else:
                      print("Game over")
                      loading(1)
                      break
            elif lanjut == 'n':
                print(f"\n{tsl['encounter']['ignore']}{enemy.name}\n\n")
                enemy = None
                loading(1)
                on = False
                break
                
            else:
                clear()
                
                dash()
                print(f"{printf(tsl['invalid'])}")
                dashn()
                
                confirm()
                continue
            
            break
            
    if berjalan == 2:
        shop(hero,tsl)
        clear()
        
    else:
        clear()
        
        dash()
        print(f"{printf(tsl['walk'])}")
        dashn()


#special shop interaction checker
def isSpecialShop(player,tsl=tsl):
    if player.role == "thief":
        print(f"\n0)Mencuri? :v")
        pass
    
    
    if player.role == "bandit":
        print(f"\n0)Rampok? :v")
        pass
    
    
    if player.role == "hero":
        print(f"\n0)Tunjukkan jasa?\n(menyombongkan diri dengan poin reputasi)\n\nPoin reputasi: {player.reputation}:v")
        pass
        
    else:
        pass
        
#shop
def shop(player,tsl=tsl):
    
    encounter = 0
    pilihan = None
    
    while True:
        clear()
        
        if dialogue(encounter):
            pass
        
        else:
            
            dash()
            print(f"{tsl['shop']['greet']}")
            dashn()
            
        
        
        print(f"Your balance: {player.coin}G")
        
        isSpecialShop(player)
        print("1)Beli\n2)Jual\n3)Pergi")
        try:
            
            pilihan = int(input("\nPilih(1,2,3) : "))
            if pilihan not in [0,1,2,3,4]:
                print("Harap masukkan pilihan yang tersedia! (1/2/3)")
                loading(1)
        except ValueError:
            print("Apakah kau bisa baca oh orang asing?")
            loading(1)
            
            
            
        if pilihan == 0:
            maintenance()
            break
    
        if pilihan == 1:
            buy(player,tsl)
            pass
            
        if pilihan == 2:
            
            sell(player,tsl)
            pass
        
        if pilihan == 3:
            encounter+=1 #adds how many you encounter the shop
            break
            
        else:
            pass
            
#foods effect
def apple(p):
    p.health += 10
    print("\nIts freshness helps you on adventure :D\n")
    print(f"""
    Temporary buff added:
        1. Bullseye (Crit Rate & Damage +5%)
        """)
    #maintenanced feature
    
#eating items
def eat(player,item):
    #on maintenance
    if item not in foods:
        print("You can't eat that :D")
    else:
        
        if item == "Apple":
            Apple(player)
            
#buy
def buy(player,tsl=tsl):
    keranjang = []
    receipt = {}
    while True:
        clear()
        try:
            index=1
            
            daftar_buah,detail_buah = Makanan.getDaftarBuah(True)
            
            
            dash()
            print(f"{printf(tsl['shop']['cart'])}")
            dash()
            
            
            for i in sorted(set(keranjang)) :
                duplicate = keranjang.count(i)
                
                if duplicate > 1:
                    
                    print(f"- {detail_buah[i]['name']:<20} {'x':>11}{duplicate}")
                    receipt.update({i:duplicate})
                        
                else:
                    
                    print(f"- {detail_buah[i]['name']}")
                    receipt.update({i:1})
            
            print(f"""
{dash(r=True)}
{tsl['shop']['confirm']}
{dash(r=True)}
0. {tsl['shop']['pay']}
k. {tsl['shop']['back']}
h. {tsl['shop']['delete']}
""")
            buah = input("Buah yang ingin dibeli : ")
            
            
                
            if buah == "":
                clear()
                pass
                
            elif buah.lower() == "k":
                break
                    
                
            elif buah == "0":
                
                if keranjang == []:
                    dash()
                    print("KAMU BELUM MEMBELI APAPUN")
                    dashn()
                    pass
                    
                else:
                    
                    try:
                        clear()
                        Makanan.getTotalPrice(keranjang,receipt)
                        confirm()
                        loading(1)
                        
                        break
                        
                    except:
                        break
            
            elif buah.lower() == "h":
                maintenance()
                
            
            try:
                 
                beli = Makanan.getBuah(int(buah))
                
                if beli == None:
                    
                    raise ValueError
                    
                    pass
                    
                else:
                
                    keranjang.append(beli)
                
            except:
                pass
            
        except ValueError:
            print(f"\n{tsl['invalidnum']}")
            loading(1)
            pass
    
    player.addInv(keranjang)



def sell(player,tsl=tsl):
    daftar_buah, daftar_harga = Makanan.getDaftarBuah()

    while True:
        if not player.inventory:  # Check if inventory is empty
            clear()
            
            dash()
            print(f"{printf(tsl['shop']['empty'])}")
            dashn()
            
            confirm()
            loading(0.5)
            break
        else:
            clear()
            try:
                
                print("What do you want to sell?")
                dash()
                counter = 1
                
                # Display items in the player's inventory
                inventory_map = {}
                for item in player.inventory:
                    if item in daftar_buah:
                        print(f"{counter:>2}. {daftar_harga[item]['name']:<17}{daftar_harga[item]['price']:>3}G")
                        inventory_map[counter] = item
                        counter += 1

                if not inventory_map:  # If no sellable items are found
                    print("No sellable items in your inventory!")
                    confirm()
                    break
                
                # Get user input
                try:
                    
                    beli = int(input("\nEnter the item number: "))
                    selected_item = inventory_map.get(beli)

                    if selected_item:
                        print(f"\n\nSell {daftar_harga[selected_item]['name']} for {daftar_harga[selected_item]['price']}? (y/n)")
                        membeli = input(": ").strip().lower()

                        if membeli == "y":
                            player.inventory.remove(selected_item)
                            player.coin += daftar_harga[selected_item]['price']
                            print(f"\nYou sold {daftar_harga[selected_item]['name']}!")
                            confirm()
                            continue
                            
                        elif membeli == "n":
                            print("\nCanceled the selling.")
                            loading(1)
                            break
                            
                        else:
                            print(f"{tsl['invalid']}")
                        loading(1)
                        pass
                        
                    else:
                        print("Item not found!")
                        loading(1)
                        
                except ValueError:
                    print("Invalid input! Please enter a number.")
                    loading(1)
                    
            except Exception as e:
                print(f"An error occurred: {e}")
                confirm()
                break

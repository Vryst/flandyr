

from game.classes import *

import random


def maintenance():
    print("Fitur maintenance! :v")
    loading(1)



def create_hero(hero_name, hero_class):
    roles = [
       #("role",   HP   ATK  DEF AGI CRATE CDMG)
        ("warrior", 1000, 130, 30, 15, 35, 80),
        ("mage", 400, 270, 15, 10, 10, 120),
        ("archer", 700, 80, 25, 45, 50, 100),
        ("hero", 2000, 100, 70, 10, 30, 100),
        ("thief", 450, 50, 15, 70, 75, 200),
        ("bandit", 900, 95, 20, 5, 25, 70)
    ]
    
    role, health, attack, defend, agility, crit_rate, crit_dmg = roles[hero_class - 1]
    return Hero(hero_name, role, health, attack, defend, agility, crit_rate, percent(crit_dmg))





def main(load=False):
    clear()
    
    if load == False:
        hero_name, hero_class = pilih_role()  # Pass directly
        hero = create_hero(hero_name, hero_class)
        
    elif load != False:
        hero = Hero.loadData(load)
        
        dash()
        print("LOADED CHAR")
        dashn()
        
        print(hero)
        confirm()
        loading(0.5)
    
    while True:
        encounter(hero)
        
        
        confirm()
    
    

#pilih role
def pilih_role():
    
    print(f"Selamat datang di Athanor :v\n\n\n")
    
    hero_name = str(input("masukkan nama hero: "))
    while True:
        try:
            hero_class = int(input("\npilih role :\n 1. Warrior\n 2. Mage\n 3. Archer\n 4. Hero\n 5. Thief\n 6. Bandit\n\npilihan: "))
            
            if hero_class in roles_index:
                break
            else:
                pass
                
        
        
        except:
            print("Harap pilih role yang tersedia!")
            pass
        
        
    return hero_name, hero_class
    
    

def battle(player,enemy):
            clear()
            print(f"Kamu bertarung melawan {enemy.name}!\n")
            
            while True:
                
                print(f"{player.name}'s HP: {player.health}")
                print(f"{enemy.name}'s HP: {enemy.health}")
                
                
                try:
                    
                    while True:
                        try:
                            print("""
Pilih aksi yang tersedia:
      1. Serang
      2. Bertahan
      3. Item
      4. Kabur\n""")
                            aksi_battle = int(input("Pilihan(1/2/3/4): "))
                            if aksi_battle in [1, 2, 3, 4]:
                                break  # Exit the loop if valid input is given
                            else:
                                clear()
                                print("Pilihan tidak valid. Silakan pilih 1, 2, 3, atau 4.")
                                loading(1)
                        except ValueError:
                            clear()
                            print("Harap masukkan angka yang valid (1/2/3/4).")
                            loading(1)
        
                    if aksi_battle == 1:
                        player.Attack(enemy)
                        loading(1)
                        enemy.Attack(player)
                        loading(1)
                        
                    if aksi_battle == 2:
                        clear()
                        player.Guard()
                        
                        loading(1)
                        enemy.Attack(player)
                        loading(1)
                        
                        pass
                        
                    if aksi_battle == 3:
                        clear()
                        
                        while True:
                            
                            try:
                                a = 1
                                for i in player.inventory :
                                    print(f"{a:>2}. {Makanan.detail_buah[i]['name']}")
                                    a += 1
                                pilih_item = int(input("Pilih item yang ingin digunakan: "))
                                #fungsi_item
                                maintenance()
                                
                                break
                            except ValueError:
                                clear()
                                print("Harap masukkan index yang valid!")
                                loading(1)
                                
                    if aksi_battle == 4:
                        
                        if enemy.health <= 0:
                            break
                        elif player.health <= 0:
                            break
                        try:
                            kabur = player.Run()
                            if kabur:
                                print("kamu kabur")
                                loading(1)
                                break
                            else:
                                print("gagal")
                                loading(1)
                                clear()
                        except TypeError:
                            print("Easter egg! :D")
                            
                    else:
                        clear()
                        pass
                except ValueError:
                    clear()
                    print("Harap masukkan input yang valid(1/2/3/4)!\n")
            if player.health <= 0:
                return False
                
            if enemy.health <= 0:
                
                return True
            
            else:
                return "kabur"

#event
def pergi():
    menemukan = random.choice(range(2))
    return 1 if menemukan == 1 else 2
    
    

    
#encounter
def encounter(hero):
    
    berjalan = pergi()
    
    
    on = True
    if berjalan == 1:
       while on:
        
        enemy = Enemy(randomizer(musuh),randomizer(roles),randomizer(),randomizer(),randomizer(),randomizer(),randomizer(),randomizer())
        
        enemy.getStat()
        lanjut = input("Serang? (y/n) : ").lower()
        
        if lanjut == "y":
                  hasil_pertarungan = battle(hero,enemy)
                  if hasil_pertarungan == "kabur":
                      print("\nKamu berhasil melarikan diri")
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
        if lanjut == 'n':
            print(f"\nKamu menghiraukan {enemy.name}\n\n")
            enemy = None
            loading(1)
            break
     
    if berjalan == 2:
        shop(hero)
        clear()
        
    else:
        clear()
        print("Kamu berjalan tanpa arah")



#special shop interaction checker
def isSpecialShop(player):
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
def shop(player):
    
    aksi = True
    
    pilihan = None
    while aksi:
        clear()
        print(f"Your balance: {player.coin}G")
        print(f"Selamat datang di toko, orang asing! heheh..\n")
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
            buy(player)
            pass
            
        if pilihan == 2:
            
            sell(player) #not stable
            pass
        
        if pilihan == 3:
            aksi = False
            
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
def buy(player):
    keranjang = []
    receipt = {}
    while True:
        clear()
        try:
            index=1
            
            daftar_buah,detail_buah = Makanan.getDaftarBuah(True)
            
            
            dash()
            print(f"{'DAFTAR KERANJANG':^36}")
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
Jangan input apapun jika lanjut beli
Input "0" untuk melakukan pembayaran
{dash(r=True)}
0. Bayar
k. kembali
h. hapus item
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
                    dash()
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



def sell(player):
    daftar_buah, daftar_harga = Makanan.getDaftarBuah()

    while True:
        if not player.inventory:  # Check if inventory is empty
            clear()
            print("You don't have anything to sell :D\n\n")
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

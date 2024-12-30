from datetime import datetime
from game.prep import tsl
from game.prep import user_width
from game.prep import confirm
from game.prep import dash
from game.prep import dashn
from game.prep import loading
from game.prep import clear
from game.prep import random
from game.prep import json
from game.prep import os
from game.prep import printf


roles_index = [
1,
2,
3,
4,
5,
6
]

#roles_index.append(len(roles_index)+1)
#print(roles_index)

roles = [
"warrior",
"archer",
"mage",
"assassin",
"cleric",
"alchemist",
"monk"
]

subroles = [
"hero",
"bandit"

]
special_shop = [
"hero",
"assassin",
"bandit",
"alchemist"
]

musuh = [
"knight",
"skeleton",
"slime",
"tree",
"elmanuk",
"otong",
"jo",
"go",
"worga",
"ctulhu",
"jasendiri",
"zagon",
"cuda",
"loic",
"punda",
"vorhs",
"nokl",
"wryth"
]


#random picker
def randomizer(a=100):
    try:
            if type(a) == int:
                return random.choice(range(a))
            elif type(a) == list:
                return random.choice(a)
    except (TypeError, ValueError):
            print("\n\nMohon masukkan data dengan benar\n\n")


#percent
def percent(num=1):
        return num/100
        
        
#checking crit success
def critical(player):
    success = random.choice(range(1,100+1)) <= player.crate
    
    return success
    

#reducing input damage 
def attack_reduction(target,amount):
    
    
    
    if target.attack - amount <= 0:
        result = 0
        
        return result
    else:
        result = target.attack - amount
        return result
    


def get_loot(enemy):
    loot_table = {
        "serigala": [{"item": "Kulit Serigala", "chance": 0.8, "value": 5}],
        "naga": [
            {"item": "Taring Naga", "chance": 0.5, "value": 100},
            {"item": "Tulang Naga", "chance": 0.2, "value": 200}
        ]
    }
    loot = loot_table.get(enemy, [])
    dropped_items = []
    for item in loot:
        if random.random() < item["chance"]:
            dropped_items.append({"name": item["item"], "value": item["value"]})
    return dropped_items

#Contoh:
#loot = get_loot("naga")
#print(loot)  # Output: Drop acak dari loot naga


#============={{HERO}}===============
class Hero:
    
    def __init__(self,
    name="Dummy",
    role="Dummy",
    subroles=[],
    health=1,
    attack=0,
    defend=0,
    crate=0,
    cdamage=0,
    strength=1,
    vitality=1,
    agility=1,
    intelligence=1,
    coin=0,
    reputation=0,
    inventory=[],
    
    ctime=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    guard=False):
        
        self.name = name
        self.role = role
        self.subroles = subroles
        
        self.strength = strength
        self.vitality = vitality
        self.agility = agility
        self.intelligence = intelligence
        
        self.health = int(health * (self.vitality * 0.5))
        self.attack = int(attack * (self.strength * 0.8))
        self.defend = defend
        self.crate = crate
        self.cdamage = cdamage
        
        self.ctime = ctime
        
        self.guard = guard
        self.inventory = inventory
        self.coin = coin
        
        self.year = ctime[0:4]
        self.month = ctime[5:7]
        self.day = ctime[8:10]
        self.hour = ctime[11:13]
        self.minute = ctime[14:16]
        self.second = ctime[17:19]
        
        if "hero" in self.subroles:
            
            self.reputation = reputation + 100
        else:
            self.reputation = reputation
        
    
    def __repr__(self):
        return (f"Hero(name={self.name}, role={self.role}, hp={self.health}, attack={self.attack}, "
                f"defend={self.defend}, agility={self.agility}, crit_rate={self.crate}, "
                f"crit_damage={self.cdamage}), created_time={self.ctime}")
                
                
    def __str__(self):
        
        print(f"""
==================== DATA
Date created:
    Year   : {self.year}
    Month  : {self.month}
    Day    : {self.day}
    Hour   : {self.hour}
    Minute : {self.minute}
    Second : {self.second}
==================== PROFILE         
Name  = {self.name}
 Class = {self.role}
  Sub-class = {" ".join(i for i in subroles)}
   Coins = {self.coin}
    Reputation = {self.reputation}
==================== STATS
HP = {self.health}
 ATK = {self.attack}
  DEF = {self.defend}
   CRIT RATE = {self.crate}%
    CRIT DAMAGE = {int(self.cdamage*100)}%
==================== MULTIPLIER
STR = {self.strength}
 VIT = {self.vitality}
  AGI = {self.agility}
   INT = {self.intelligence}
==================== INVENTORY
        """)
        self.getInv()
        return ""
    
    @classmethod
    def saveData(cls,self, filename):
        """
        Save data to a JSON file.
        
        Args:
        data (dict): The data to save, typically a dictionary.
        filename (str): The name of the file where data will be saved.
        
        Returns:
        None
        """
        
        base_dir = os.path.dirname(os.path.abspath(__file__))  # Directory of classes.py
        file_path = os.path.join(base_dir, filename)
        
        
        try:
            data = dict(self.__dict__)
            with open(file_path, 'w') as file:
                json.dump(data, file, indent=4, default=str)
            print(f"Data saved to {filename}")
        except Exception as e:
            print(f"Error saving data: {e}")
            
            
    @classmethod
    def loadData(cls, json_file):
        """Class method to load Hero data from a JSON file."""
        
        base_dir = os.path.dirname(os.path.abspath(__file__))  # Directory of classes.py
        file_path = os.path.join(base_dir, json_file)
        
        # Check if the file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        with open(file_path, 'r') as file:
            data = json.load(file)
            
            
        for k in data['inventory']:
            print(k)
            
        return cls(
            name=data['name'],
            role=data['role'],
            health=data['health'],
            attack=data['attack'],
            defend=data['defend'],
            strength=data['strength'],
            vitality=data['vitality'],
            agility=data['agility'],
            intelligence=data['intelligence'],
            crate=data['crate'],
            cdamage=data['cdamage'],
            guard=data['guard'],
            inventory=[i for i in data['inventory']],
            ctime=data['ctime'],
            reputation=data['reputation']
            
            
        )
    
    
    def clearInv(self):
        self.inventory = []
        print("Inventory set to ",self.inventory)
        
    
    def addInv(self,*item):
        for i in item:
            self.inventory.extend(i)
        
    
    def getInv(self):
        counter = 1
        
        if self.inventory == []:
            
            print(f"{tsl['noitem']}")
        
        for item in self.inventory:
            index = 1
            if buah in Makanan.buah:
                
                print(f"{counter:>2}. {Makanan.detail_buah[item]['name']}")
                counter+=1
            else:
                print(f"{printf(index,item)}")
                
        
    def getStat(self):
        print(f"""
        Name = {self.name}
        Class = {self.role}
        HP = {self.health}
        ATK = {self.attack}
        DEF = {self.defend}
        AGI = {self.agility}
        CRIT RATE = {self.crate}
        CRIT DAMAGE = {self.cdamage}
        """)
        
    def Attack(self, target, tsl=tsl):
        clear()
        
        total_damage = self.attack
        crit = critical(self)
        
        if target.health <=0 and self.health <= 0:
            print(f"{self.name} & {target.name} {tsl['encounter']['battle']['dead']}\n")
            
        elif target.health <= 0:
            print(f"{target.name} {tsl['encounter']['battle']['dead']}")
            print(f"{self.name} HP = {self.health}\n{target.name} HP = {target.health}")
            
            pass
            
        elif self.health <= 0:
            print(f"{self.name} {tsl['encounter']['battle']['dead']}")
            print(f"{self.name} HP = {self.health}\n{target.name} HP = {target.health}")
            
            pass
            
        else:
            
            if target.guard == True:
                target.health -= attack_reduction(self,target.defend*2)
                
                target.guard = False
                
            else:
                
                if crit:
                    
                    total_damage += int(self.attack * percent(self.cdamage))
                    target.health -= total_damage
                    
                    
                    
                else:
                    crit = False
                    target.health -= total_damage
            
            clear()
            
            #critical hit alert
            if crit:
                print(f"{self.name} CRITICAL HIT\n")
                
                
            print(f"{self.name} HP = {self.health}\n{target.name} HP = {target.health}")
            
            print(f"\n\n{self.name} {tsl['encounter']['battle']['dealt']} {total_damage} {tsl['to']} {target.name}")
        
        total_damage = self.attack
            
    def Guard(self,tsl=tsl):
        self.guard = True
        print(f"{tsl['encounter']['battle']['guard1']} {self.name} {tsl['encounter']['battle']['guard2']}")
        #print(f"Defend milik {self.name} telah meningkat 2x lipat!")
        
    def Run(self):
        return random.randint(1, 100) <= self.agility


class Enemy(Hero):
    
    pass
    
#a = Hero()
#Hero.saveData(a,"playerData/acapona.json")

class Item:
    
    def __init__(self, name, base_price, rarity):
        self.name = name
        self.base_price = base_price
        self.rarity = rarity
        self.current_price = base_price
    
    
    
    def update_price(self, quantity_sold):
        demand_factor = max(0.5, 1 - (quantity_sold * 0.1))
        self.current_price = round(self.base_price * demand_factor)
        
    
    #Template untuk update selanjutnya
    #equipment info
    def getDetail(self,filepath):
            item = self.name
            try:
                
                with open(filepath, "r") as file:
                    data = json.load(file)  # Membaca file JSON
                    # Iterasi untuk mendapatkan key dan value
                    print(f"""
Item name: {data[item]['name']}
Details:
        Price: {data[item]['price']}
        Heal: {data[item]['heal']}
        Buff: {data[item]['buff']}
        Expired time: {data[item]['expire']}
                        """)
            except:
                print(f"{tsl['errload']}")
                loading(2)
#Contoh:
#taring_naga = Item("Taring Naga", 100, "Rare")
#taring_naga.update_price(quantity_sold=5) #per 1 quantity = 10 decrease 
#print(taring_naga.current_price)  # Output: Harga menurun berdasarkan jumlah penjualan
#taring_naga.getDetail("items.json")


class Makanan(Item):
    buah = []
    detail_buah = {}
    with open("../resources/foods.json","r") as file:
            daftar_buah = json.load(file)
            buah.extend(daftar_buah.keys())
            
            detail_buah.update(daftar_buah.items())

    def __init__(self,name,heal):
        
        super().__init__(name,base_price,rarity)
        self.name = name
        self.base_price = base_price
        self.current_price = base_price
        self.heal = heal
        self.rarity = rarity
        
    def __str__(self):
        print(f"{self.name} efek heal {self.heal}")
        
    
    
    @classmethod
    def getDaftarBuah(cls,p=False):
        
        
        if p == True:
            
            index = 1
            print("\nDAFTAR BUAH\n=============")
            for i in cls.buah:
                print(f"{index:<2} {cls.detail_buah[i]['name']:<20} {cls.detail_buah[i]['price']:>3} G")
                index +=1
        
        return cls.buah, cls.detail_buah
            
    
    @classmethod
    def getBuah(cls,index,p=False):
        
        try:
            if index <= 0:
                raise IndexError
                
            else:
                pass
                
            if p==True:
                
                print(f"Buah yang diambil {cls.buah[index-1]}")
            return cls.buah[index-1]
            
        except IndexError as e:
            #dash()
#            print("Error:\n",e)
#            dash()
#            print("\nWe didn't have that kind of food :D")
#            print("Food number ",index, "Not found\n")
#            loading(1)
            pass
            
        
    @classmethod
    def getDetail(cls,buah):
            
            with open("../resources/foods.json", "r") as file:
                data = json.load(file)  # Membaca file JSON
                
                print(f"""
Item   : {buah}
Details:
        Name: {data[buah]['name']}
        Price: {data[buah]['price']}
        Heal: {data[buah]['heal']}
        Buff: {data[buah]['buff']}
        Expired time: {data[buah]['expire']}
                    """)
                    
                    
    @classmethod
    def getTotalPrice(cls,*fruits):
        try:
            # Pastikan ada dua elemen yang diterima
            keranjang, receipt = fruits
        except ValueError:
            raise ValueError("Pastikan argumen berisi dua elemen: list dan dict.")

        total = 0
        price_list = {}
        
        # Baca file JSON
        with open("../resources/foods.json", "r") as file:
            data = json.load(file)
            # Buat dictionary harga
            for i, j in data.items():
                price_list[i] = j['price']

        # Hitung total harga
        for item in sorted(list(set(keranjang))):
            if item in price_list and item in receipt:
                total += price_list[item] * receipt[item]
                
            else:
                print(f"Item '{item}' tidak ditemukan dalam price_list atau receipt.")

        
        # Debug output
        print(f"{'Receipt':^36}")
        dash()
        for i,j in receipt.items():
            print(f"{cls.detail_buah[i]['name']:<17}{'x':>6}{j:<2}{cls.detail_buah[i]['price']:>10}G")
        print(f"\n{'Total:':>31}{total:>4}G\n")
        return total
        
    #def sellFood(self,*foods):
#        fruits = [i for i in foods] if foods else []
#        index = 1
#        for i in len(fruits):
#            print(f"{index:>2}. {i}")
#        confirm()
        

#print(Makanan.getTotalPrice(['apple', 'banana', 'apple'], {'apple': 3, 'banana': 2}))


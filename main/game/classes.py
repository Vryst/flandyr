#!/usr/bin/env python3
"""
Module for an RPG game with classes Hero, Enemy, Item, Makanan, etc.

Dependencies:
- game.prep.* (some custom or external library with dash, clear, etc.)
- resources/foods.json for fruit definitions
"""

import os
import json
import random
from datetime import datetime
from typing import List, Dict, Optional, Any
# from game.prep import tsl, user_width, confirm, dash, dashn, loading, clear, printf, printl
# The lines above are commented out since we don't have the actual 'game.prep'.
# We'll define placeholders for clarity.

# Dummy placeholders for external functions.
def tsl_get(key):
    # Example: return dict with a nested key for i18n usage
    return f"[Placeholder text for {key}]"

def clear():
    print("\n" * 5)  # Simple clear placeholder

def dash():
    print("-" * 30)

def dashn():
    print("\n" + "-"*30)

def loading(seconds=1):
    print(f"[Loading for {seconds} second(s)...]")

def printf(*args):
    """ Mocks printing with spacing or formatting. """
    return " ".join(map(str,args))

# ~~~~~ Resource dictionaries (unchanged) ~~~~~
roles = {
    "warrior": {
        "HP": 1000, "ATK": 130, "DEF": 30, "CRATE": 35, "CDMG": 80,
        "STR": 5, "VIT": 8, "AGI": 15, "INT": 3, "COIN": 0, "REPUTATION": 0,
        "INVENTORY": ["sword", "light helmet", "medium armor", "medium legging", "leather boots"]
    },
    # ... plus archer, mage, assassin, cleric ...
}

roles_index = [i for i in range(len(roles))]

sub_roles = {
    # ...
}

special_shop = ["hero", "assassin", "bandit", "alchemist"]
musuh = ["knight","skeleton","slime","tree","elmanuk","otong","jo",
         "go","worga","ctulhu","jasendiri","zagon","cuda","loic",
         "punda","vorhs","nokl","wryth"]

# ~~~~~ Utility Functions ~~~~~
def randomizer(a=100) -> Any:
    """
    If 'a' is an integer, return a random int in [0..a).
    If 'a' is a list, return a random element.
    """
    if isinstance(a, int):
        return random.choice(range(a))
    elif isinstance(a, list):
        return random.choice(a)
    else:
        raise TypeError("Unsupported type for randomizer.")

def percent(num=1) -> float:
    return num / 100.0

def critical(player) -> bool:
    """Check if an attack is critical based on player's crate (crit rate)."""
    # crate is presumably an integer representing percentage (1..100)
    return random.randint(1, 100) <= player.crate

def attack_reduction(target, amount: int) -> int:
    """Compute the reduced attack after target's defense is applied."""
    if target.attack - amount <= 0:
        return 0
    return target.attack - amount

def get_loot(enemy_name: str) -> List[Dict[str,Any]]:
    """
    Example loot system: returns a list of dropped items for a given enemy.
    This is just a placeholder demonstration.
    """
    loot_table = {
        "serigala": [{"item": "Kulit Serigala", "chance": 0.8, "value": 5}],
        "naga": [
            {"item": "Taring Naga", "chance": 0.5, "value": 100},
            {"item": "Tulang Naga", "chance": 0.2, "value": 200}
        ]
    }
    possible_loots = loot_table.get(enemy_name, [])
    dropped_items = []
    for entry in possible_loots:
        if random.random() < entry["chance"]:
            dropped_items.append({"name": entry["item"], "value": entry["value"]})
    return dropped_items

# ~~~~~ Hero & Enemy Classes ~~~~~

class Hero:
    """
    Represents a hero/character in the game with stats, inventory, etc.
    """
    def __init__(self,
                 name: str = "Dummy",
                 role: str = "Dummy",
                 subroles: List[str] = None,
                 health: int = 1,
                 attack: int = 0,
                 defend: int = 0,
                 crate: int = 0,
                 cdamage: int = 0,
                 strength: int = 1,
                 vitality: int = 1,
                 agility: int = 1,
                 intelligence: int = 1,
                 coin: int = 0,
                 reputation: int = 0,
                 inventory: Optional[List[str]] = None,
                 ctime: str = None,
                 guard: bool = False):
        
        if subroles is None:
            subroles = []
        if inventory is None:
            inventory = []
        
        self.name = name
        self.role = role
        self.subroles = subroles
        
        self.strength = strength
        self.vitality = vitality
        self.agility = agility
        self.intelligence = intelligence
        
        # Basic formula for HP, ATK, etc.
        self.health = int(health * (self.vitality * 0.5))
        self.attack = int(attack * (self.strength * 0.8))
        self.defend = defend
        self.crate = crate
        self.cdamage = cdamage
        
        self.guard = guard
        self.inventory = inventory
        self.coin = coin
        
        self.reputation = reputation
        if "hero" in self.subroles:
            self.reputation += 100
        
        # Time of creation
        if ctime is None:
            ctime = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        self.ctime = ctime
        
        # Decompose the time
        self.year   = ctime[0:4]
        self.month  = ctime[5:7]
        self.day    = ctime[8:10]
        self.hour   = ctime[11:13]
        self.minute = ctime[14:16]
        self.second = ctime[17:19]
    
    def __repr__(self):
        return (f"Hero(name={self.name}, role={self.role}, hp={self.health}, "
                f"attack={self.attack}, defend={self.defend}, agility={self.agility}, "
                f"crit_rate={self.crate}, crit_damage={self.cdamage}, created={self.ctime})")
    
    def __str__(self):
        dash()
        print(f"CREATED: {self.year}-{self.month}-{self.day} {self.hour}:{self.minute}:{self.second}")
        dash()
        print(f"Name        : {self.name}")
        print(f"Class       : {self.role}")
        print(f"Sub-class   : {', '.join(self.subroles) if self.subroles else 'None'}")
        print(f"Coins       : {self.coin}")
        print(f"Reputation  : {self.reputation}")
        dash()
        print(f"HP          : {self.health}")
        print(f"ATK         : {self.attack}")
        print(f"DEF         : {self.defend}")
        print(f"Crit Rate   : {self.crate}%")
        print(f"Crit Damage : {int(self.cdamage*100)}%")
        dash()
        print(f"STR: {self.strength}  VIT: {self.vitality}  AGI: {self.agility}  INT: {self.intelligence}")
        dash()
        print("INVENTORY:")
        self.getInv()
        dash()
        return ""
    
    @classmethod
    def saveData(cls, hero_obj, filename: str):
        """
        Save hero data to a JSON file.
        """
        base_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(base_dir, filename)
        
        data = hero_obj.__dict__.copy()
        
        # Remove derived year/month/etc. if desired, or keep them
        # data.pop('year', None)
        # data.pop('month', None)
        # ...
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            print(f"Data saved to {file_path}")
        except Exception as e:
            print(f"Error saving data: {e}")
    
    @classmethod
    def loadData(cls, json_file: str):
        """
        Load hero data from JSON file, returning a Hero instance.
        """
        base_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(base_dir, json_file)
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
        
        # Construct Hero
        loaded_hero = cls(
            name=data.get('name', 'Unknown'),
            role=data.get('role', 'Unknown'),
            subroles=data.get('subroles', []),
            health=data.get('health', 1),
            attack=data.get('attack', 0),
            defend=data.get('defend', 0),
            crate=data.get('crate', 0),
            cdamage=data.get('cdamage', 0),
            strength=data.get('strength', 1),
            vitality=data.get('vitality', 1),
            agility=data.get('agility', 1),
            intelligence=data.get('intelligence', 1),
            coin=data.get('coin', 0),
            reputation=data.get('reputation', 0),
            inventory=data.get('inventory', []),
            ctime=data.get('ctime', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
            guard=data.get('guard', False)
        )
        return loaded_hero
    
    def clearInv(self):
        self.inventory.clear()
        print("Inventory cleared.")
    
    def addInv(self, *items):
        """Add multiple items (as lists/tuples) to the inventory."""
        for i in items:
            if isinstance(i, list) or isinstance(i, tuple):
                self.inventory.extend(i)
            else:
                self.inventory.append(i)
    
    def getInv(self):
        if not self.inventory:
            print(f"[No items found in inventory]")
        else:
            for idx, item in enumerate(self.inventory, start=1):
                print(f"{idx}. {item}")
    
    def getStat(self):
        dash()
        print(f"Name: {self.name} | Class: {self.role}")
        print(f"HP : {self.health} | ATK : {self.attack} | DEF : {self.defend} | AGI : {self.agility}")
        print(f"Crit Rate : {self.crate} | Crit Damage : {self.cdamage}")
        dash()
    
    def Attack(self, target):
        """Perform an attack on 'target' which is presumably another Hero or Enemy."""
        clear()
        
        if target.health <= 0 or self.health <= 0:
            print("[Combat unavailable: one of the participants is already dead.]")
            return
        
        total_damage = self.attack
        is_crit = critical(self)
        
        # If target is guarding
        if target.guard:
            # reduce the attacker’s effective attack by target’s defense * 2
            reduced = attack_reduction(self, target.defend * 2)
            target.health -= reduced
            target.guard = False
        else:
            # Normal or crit
            if is_crit:
                total_damage += int(self.attack * percent(self.cdamage))
            target.health -= total_damage
        
        clear()
        if is_crit:
            print(f"CRITICAL HIT by {self.name}!")
        
        print(f"{self.name} dealt {total_damage} damage to {target.name}.")
        print(f"{self.name} HP: {self.health} | {target.name} HP: {target.health}")
    
    def Guard(self):
        self.guard = True
        print(f"{self.name} is now guarding! Incoming damage will be reduced.")
    
    def Run(self) -> bool:
        """Attempts to flee combat based on hero's agility."""
        return random.randint(1, 100) <= self.agility

class Enemy(Hero):
    """
    Inherits from Hero for convenience, but can add extra logic if needed.
    """
    pass

# ~~~~~ Items ~~~~~

class Item:
    """
    Basic item with base price, rarity, dynamic pricing.
    """
    def __init__(self, name: str, base_price: int, rarity: str):
        self.name = name
        self.base_price = base_price
        self.rarity = rarity
        self.current_price = base_price
    
    def update_price(self, quantity_sold: int):
        """
        Example dynamic pricing: reduce price by 10% per quantity sold, to a floor of 50%.
        """
        demand_factor = max(0.5, 1 - (quantity_sold * 0.1))
        self.current_price = round(self.base_price * demand_factor)

    def getDetail(self, filepath: str):
        """
        Example of reading from an external JSON to get extended details about this item.
        """
        try:
            with open(filepath, "r", encoding='utf-8') as f:
                data = json.load(f)
            if self.name in data:
                info = data[self.name]
                print(f"Item: {info['name']}\nPrice: {info['price']}\nHeal: {info['heal']}\nExpire: {info['expire']}")
            else:
                print("[Item details not found in JSON]")
        except Exception as e:
            print(f"[Error loading item detail: {e}]")

class Makanan(Item):
    """
    Subclass for food items, referencing an external foods.json for available fruits data.
    """
    # Load static data at class level
    with open("../resources/foods.json","r", encoding='utf-8') as file:
        daftar_buah = json.load(file)
    buah = list(daftar_buah.keys())
    detail_buah = daftar_buah
    
    def __init__(self, name: str, heal: int, base_price: int = 10, rarity: str = "common"):
        super().__init__(name, base_price, rarity)
        self.heal = heal
    
    def __str__(self):
        return f"[Food] {self.name} heals {self.heal}"
    
    @classmethod
    def getDaftarBuah(cls, p: bool=False):
        """
        Returns the list of fruits. If p=True, prints them nicely.
        """
        if p:
            dash()
            print("DAFTAR BUAH")
            dashn()
            for idx, fruit_key in enumerate(cls.buah, start=1):
                info = cls.detail_buah[fruit_key]
                print(f"{idx:<2} {info['name']:<20} {info['price']:>3} G")
        return cls.buah, cls.detail_buah
    
    @classmethod
    def getBuah(cls, index: int, verbose: bool=False) -> Optional[str]:
        """
        Returns the fruit key at the given index (1-based). If out of range, returns None.
        """
        try:
            fruit = cls.buah[index-1]
            if verbose:
                print(f"Selected: {fruit}")
            return fruit
        except IndexError:
            if verbose:
                print(f"No fruit at index {index}.")
            return None
    
    @classmethod
    def getDetail(cls, buah_key: str):
        """
        Print details of a single fruit from foods.json data.
        """
        if buah_key in cls.detail_buah:
            info = cls.detail_buah[buah_key]
            dash()
            print(f"Item   : {buah_key}")
            print(f"Name   : {info['name']}")
            print(f"Price  : {info['price']}")
            print(f"Heal   : {info['heal']}")
            print(f"Buff   : {info['buff']}")
            print(f"Expire : {info['expire']}")
            dash()
        else:
            print(f"[Fruit '{buah_key}' not found in detail_buah]")
    
    @classmethod
    def getTotalPrice(cls, fruits_tuple):
        """
        Expects (keranjang, receipt) as a tuple:
          keranjang: list of fruit keys
          receipt: dict of {fruit_key: quantity}
        
        Returns total cost, prints a receipt.
        """
        keranjang, receipt = fruits_tuple
        total = 0
        
        # Build price map
        price_list = {k: v['price'] for k,v in cls.detail_buah.items()}
        
        dash()
        print("RECEIPT")
        dash()
        for item_key in sorted(set(keranjang)):
            if item_key in price_list and item_key in receipt:
                quantity = receipt[item_key]
                item_name = cls.detail_buah[item_key]['name']
                item_price = cls.detail_buah[item_key]['price']
                cost = item_price * quantity
                total += cost
                print(f"{item_name:<17} x{quantity:<2} {cost:>10} G")
            else:
                print(f"[Skipping '{item_key}': not found in price_list or receipt]")
        print(f"\n{'TOTAL:':>26}{total:>6} G\n")
        return total




import random
from scripts.helpers import *
from .container import Container
from .item import Item

class Character:
    
    
    def __init__(
    # ====== CHAR SETUP ======
    self,
    name=None,
    race=None,
    background=None,
    role=None,
    trait=None,
    is_player=True,
    
    # ====== CONDITIONS ======
    karma=0,
    stigma=None,
    buff=None,
    debuff=None,
    
    # ====== ARMORY ======
    head=None,
    neck=None,
    torso=None,
    left_arm=None,
    left_hand=None,
    right_arm=None,
    right_hand=None,
    hip=None,
    left_leg=None,
    left_knee=None,
    left_foot=None,
    right_leg=None,
    right_knee=None,
    right_foot=None,
    
    # ====== BELONGINGS ======
    inventory=None,
    bag=None,
    coins=None,
    max_weight=None,
    weight=None,
    
    # ====== STATS ======
    stat=None,
    skill=None,
    skill_dict=None
    ):
        
        self.is_player = is_player
        self.name = name if name else "dummy name"
        self.race = race if race else "dummy race"
        self.background = background if background else "dummy background"
        self.role = role if role else []
        self.trait = trait if trait else []
        
        self.karma = karma
        self.stigma = stigma if stigma else []
        self.buff = buff if buff else []
        self.debuff = debuff if debuff else []
        
        self.inventory = inventory if inventory else Container()
        self.stats = {
            "max_hp":0,
            "hp":0,
            "max_mana":0,
            "mana":0,
            "max_energy":0,
            "energy":0,
            "pa":0,
            "pp":0,
            "pd":0,
            "ma":0,
            "mp":0,
            "md":0,
            "armor":0,
            "critical_chance":0,
            "critical_damage":0
        }
        if stat:
            for key, value in stat.items():
                if key in self.stats:
                    self.stats[key] = value
                    
        if max(0,self.stats["max_hp"]) and self.stats["hp"] == 0:
                self.stats["hp"] = self.stats["max_hp"]
                
        if max(0,self.stats["max_mana"]) and self.stats["mana"] == 0:
                self.stats["mana"] = self.stats["max_mana"]
        
        if max(0,self.stats["max_energy"]) and self.stats["energy"] == 0:
                self.stats["energy"] = self.stats["max_energy"]
                
        self.skill = skill if skill else []
        self.skill_dict = skill_dict if skill_dict else []
        
    # ====== METHODS ======
    def isAlive(self):
        return self.stats["hp"] > 0
        
        
    def attack(self, target):
        
        if not self.isAlive():
            print(f"{self.name} already dead, can't attack")
            return
            
        if not target.isAlive():
            print(f"{target.name} already dead")
            return
        """
        preparing the final defense value after resolving the PEN calculation
        """
        final_defense = max(0,((target.stats["pd"] + target.stats["armor"]) - self.stats["pp"]))
        
        # calculating damage taken + critical calc (FINAL)
        
        # critical check
        isCrit = random.randint(1,100) <= self.stats["critical_chance"]
        
        crit_multiplier =self.stats["critical_damage"] if isCrit else 1
        
        final_damage = max(0,(self.stats["pa"] * crit_multiplier - final_defense))
        
         
        # taking damage
        target.stats["hp"] -= final_damage
        
        
        print(f"{target.name}'s HP: {target.stats['hp']}/{target.stats['max_hp']}") if target.stats["hp"] >= 0 else print(f"\nOVERKILL !!!\n{target.name}'s HP: {target.stats['hp']}/{target.stats['max_hp']}")
        
        print(f"{target.name} taking {final_damage} damage !!!\n\n")
        
        
    def load_abilities(self):
        '''
        Loads all the abilities from the JSON
        into the player with corresponding role/class.
        '''
        with open("data/char/abilities.json") as file:
            all_abilities = json.load(file)
            self.abilities = {
                name: data for name, data in all_abilities.items()
                if data["class"] == self.role[0]
        }
        
    
    def print_skills(self):
        '''
        For loop to each Passives and Actives skill
        the players had, along with the title and effect.
        '''
        try:
            skill_data = self.skill_dict
            print(f"{' '*2}- Passive:")
            for skill, info in skill_data[self.role].items():
                if info["type"] == "passive":
                    fade_in(f"{' '*6}{skill.title()}:", 0.010)
                    for effect, value in info["effect"].items():
                        fade_in(f"{' '*8}{effect.upper()}: {value}", 0.010)
                        
            print(f"\n\n{' '*2}- Active:")
            for skill, info in skill_data[self.role].items():
                if info["type"] == "active":
                    fade_in(f"{' '*6}{skill.title()}:", 0.010)
                    fade_in(f"{' '*8}Cost: {info.get('cost', 'None')}", 0.010)
                    for effect, value in info["effect"].items():
                        fade_in(f"{' '*10}{effect.upper()}: {value}", 0.010)
        except Exception as e:
            print(e)
        
    
    def loot(self, container, item=None):
        # PLAYER: pilih item
        if self.is_player:
            if not container.items:
                print(f"{container.name} kosong.")
                return

            print(f"\nIsi {container.name}:")
            for i, obj in enumerate(container.items, start=1):
                print(f"{i}. {obj.name} ({obj.type}) - Berat {obj.weight}")
            
            choice = input("Pilih nomor item: ")
            if not choice.isdigit() or int(choice) < 1 or int(choice) > len(container.items):
                print("Pilihan tidak valid.")
                return
            
            item = container.items[int(choice)-1]
            print("\nDetail item:")
            print(item.describe())

        # NPC atau player sudah pilih item
        if item and container.remove_item(item):
            if self.inventory.add_item(item):
                print(f"{self.name} mengambil {item.name} dari {container.name}")
            else:
                container.add_item(item)
                print(f"{self.name} tidak bisa membawa {item.name}")
    

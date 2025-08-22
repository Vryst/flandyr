

import random
from time import sleep
from os import system
from .helpers import fade_in

def clear():
    system("clear")

class Character:
    
    
    def __init__(
    # ====== CHAR SETUP ======
    self,
    name=None,
    race=None,
    background=None,
    role=None,
    trait=None,
    
    # ====== CONDITIONS ======
    karma=0,
    stigma=None,
    buff=None,
    debuff=None,
    equipments=None,
    inventory=None,
    stat=None,
    skill=None,
    skill_dict=None
    ):
        
        self.name = name if name else "dummy name"
        self.race = race if race else "dummy race"
        self.background = background if background else "dummy background"
        self.role = role if role else []
        self.trait = trait if trait else []
        self.karma = karma
        self.stigma = stigma if stigma else []
        self.buff = buff if buff else []
        self.debuff = debuff if debuff else []
        self.equipments = equipments if equipments else []
        self.inventory = inventory = inventory if inventory else []
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
        with open("data/char/abilities.json") as file:
            all_abilities = json.load(file)
            self.abilities = {
                name: data for name, data in all_abilities.items()
                if data["class"] == self.role[0]
        }
        
    def use_ability(self, ability_name, target=None):
        ability = self.abilities.get(ability_name)
        
        if not ability:
            print(f"{self.name} doesn’t have that ability.")
            return

        effect = ability["effect"]
        msg = effect.get("message", "").format(name=self.name)
        print(msg)
    
        if ability["type"] == "active":
            if "mp_cost" in effect and self.mana < effect["mp_cost"]:
                print("Not enough mana!")
                return

            if "mp_cost" in effect:
                self.mana -= effect["mp_cost"]
    
            if "pa_bonus" in effect:
                original = self.pa
                self.pa += effect["pa_bonus"]
                self.attack(target)
                self.pa = original
    
            if "ma_multiplier" in effect:
                damage = max(0, self.ma * effect["ma_multiplier"] - target.md)
                target.hp -= damage
                print(f"{target.name} took {damage} magic damage!")
        
        elif ability["type"] == "passive":
            if "pd_bonus" in effect:
                self.pd += effect["pd_bonus"]
                print(f"{self.name}'s defense increased permanently!")
        
    
    def print_skills(self):
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

        


# BATTLE TEST
a = Character(name="A")

b = Character(name="B")



if __name__ == "__main__":
    
    
    while True:
        
        io = str(input("Attack? (y/n): ")).lower()
        clear()
        if io == "y":
            
            print(f"Battle!!!\n\nA vs B\n==========")
            a.attack(b)
            
        elif io == "n":
            clear()
            print("Thanks for playing")
            
        b.attack(a)
    
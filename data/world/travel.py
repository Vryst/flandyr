import json
import time
import os

def clear():
    os.system("clear")

class Map:
    def __init__(peta,nama,deskripsi):
        peta.nama = nama
        peta.deskripsi = deskripsi
        peta.next = []
        peta.before = []
        
    
    def setNext(peta,next=None):
        try:
            if next not in peta.next:
                peta.next.append(next)
            
        except Exception as e:
            print("Error: ",e)
            
    def setBefore(peta,before=None):
        try:
            if before not in peta.before:
                peta.before.append(before)
            
        except Exception as e:
            print("Error: ",e)
            
            
    def showNext(peta):
        space = 3
        print(f"\n{'-'*50}\nLokasi setelah {peta.nama}:\n")
        for i in peta.next:
            if i == None:
                break
            
            print(f"{' '*space}|_{i.nama}")
            space += 2
            
    def showBefore(peta):
        
        pace = 3
        print(f"\n{'-'*50}\nLokasi sebelum {peta.nama}:\n")
        for i in peta.before:
            if i == None:
                break
            print(f"{' '*pace}|_{i.nama}")
            
            pace += 2
        
        

distrik1 = Map("distrik1","ini distrik pemula")
distrik2 = Map("distrik2","ini distrik menengah")
Athanor= Map("Athanor","Sarang elmanuk")


distrik1.setNext(distrik2)

distrik2.setBefore(distrik1)

distrik2.setNext(Athanor)

Athanor.setBefore(distrik2)

#distrik2.showNext()
#distrik2.showBefore()
def generate_maps_from_json(data):
    maps = []
    
    def create_maps_recursively(data, parent=None):
        if isinstance(data, list):
            for item in data:
                create_maps_recursively(item, parent)
        elif isinstance(data, dict):
            nama = data.get("nama")
            deskripsi = data.get("deskripsi", "Tidak ada deskripsi.")
            current = Map(nama, deskripsi)
            maps.append(current)
            if parent:
                parent.setNext(current)
                current.setBefore(parent)

            for key in ["benua", "negara", "kota", "distrik"]:
                if key in data:
                    create_maps_recursively(data[key], current)

    create_maps_recursively(data["planet"])
    return maps
    
with open("dunia.json") as f:
    data = json.load(f)

all_maps = generate_maps_from_json(data)

# Mulai dari peta awal (planet)
current = all_maps[0]  # Map paling awal dari list
while True:
    
    clear()
    print("Lokasi saat ini: ",current.nama)
    print("""
====================
1.) Choose next
2.) Choose before
3.) Exit
    """)
    try:
        opsi = int(input(": "))
        
        match opsi:
            case 1:
                clear()
                print("Choose place to go:")
                print("="*50)
                for i,t in enumerate(current.next,1):
                    print(f"{i}.) {t.nama}")
                    
                try:
                    
                    if current.next == []:
                        
                        print("Nothing further")
                        
                        time.sleep(1)
                        continue
                        
                    opsiNext = int(input(": "))
                    
                    if opsiNext > len(current.next):
                        print("===============")
                        print("That's not a choice")
                        print("===============")
                        time.sleep(1)
                        
                    current = current.next[opsiNext-1]
                    
                    
                except Exception as e:
                    print(e)
                    time.sleep(1)
                    clear()
                    pass
                        
            case 2:
                clear()
                print("Choose place to go:")
                print("="*50)
                for i,t in enumerate(current.before,1):
                    print(f"{i}.) {t.nama}")
                    
                try:
                    if current.before == []:
                        
                        print("Nothing further")
                        
                        time.sleep(1)
                        continue
                        
                    opsiBefore = int(input(": "))
                    
                    if opsiBefore > len(current.before):
                        print("===============")
                        print("That's not a choice")
                        print("===============")
                        time.sleep(1)
                        
                    current = current.before[opsiBefore-1]
                        
                            
                except Exception as e:
                    print(e)
                    time.sleep(1)
                    clear()
                    pass
            case 3:
                clear()
                print("Get out")
                time.sleep(1)
                break
    except Exception as e:
        print(e)
        time.sleep(1)
        clear()
        pass


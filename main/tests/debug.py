
from game import *

a = Hero()
a.addInv(Makanan.buah)
b = [i for i in Makanan.getDaftarBuah()]

#print(a.inventory)
#sell(a)
c = Hero.loadData("playerData/aja.json")

#Hero.saveData(c,"aca.json")

print(c)
#print(Makanan.buah)
#a.getInv()
#a.clearInv()
#a.getInv()

#Makanan.getDaftarBuah(True)
        


from fun import *
from classes import *

a = Hero()
a.addInv(Makanan.buah)
b = [i for i in Makanan.getDaftarBuah()]

#print(a.inventory)
#sell(a)
c = Hero.loadData("playerData/aja.json")
print(c)
#print(Makanan.buah)
#a.getInv()
#a.clearInv()
#a.getInv()

#Makanan.getDaftarBuah(True)
        

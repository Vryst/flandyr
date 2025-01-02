

# THIS IS MY DEBUG NOTES

from game.fun import *
#from game.prep import *
#from game.classes import *

#bug print 3x
#fix = default argument on function is executed(i put function as the default argument'), so its'fixed now'
#refresh_width(True)


# is the encounter bugging?
#a,b = pilih_role()
#hero = create_hero(a,b)
#encounter(hero)
# fix : well, the except didn't print the error catch so I didn't know
# bug-fixed : random module not defined, forgot to import

#aca = 'acaaca'
# I wonder if input can be formatted too
#i = input(f"aca?:{aca:^24} ")
# answer : yes it can :D

# testing method
a = Hero()
#b = Enemy()
#a.subroles = ["Hero","Demon"]
#a.addInv(["Aku","Aob"])
#print(a)
#a.addInv(Makanan.buah)
#b = [i for i in Makanan.getDaftarBuah()]
# run perfectly

main()
#pilih_role()
#shop(a)
#battle(a,b)
# checking if there is any item in inventory
#print(a.inventory)
# try except works fine

# convert its price to player.coin
#sell(a)
# this took long to create :( I'm a crook

# load save data
#c = Hero.loadData("playerData/aja.json")
# I don't know why it's throw an exception if i modify the file after it created

# saving data
#Hero.saveData(c,"aca.json")
# works fine{printf('replace_me')}



# testing add and clear inventory functions
#a.getInv()
#a.clearInv()
#a.getInv()
# works

# True argument for printing when called, default is = (p=False)
#Makanan.getDaftarBuah(True)
# works

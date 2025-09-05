

from .entities import Character
from .item import Item
from .container import Container

# buat item
buku = Item("Buku Tua", 2, 8, 2, 6, type="quest", desc="Buku berisi tulisan kuno.")
apel = Item("Apel Merah", 1, 3, 3, 3, type="food", desc="Segar dan manis.")
tombak = Item("Tombak", 3, 3, 3, 50, type="weapon", desc="Senjata panjang.")

# buat container
laci = Container("Laci Kayu", max_weight=15, width=15, height=10, depth=20)
laci.add_item(buku)
laci.add_item(apel)
laci.add_item(tombak)

# player
hero = Character("Ardyn")
hero.loot(laci)  # player pilih lewat input

# npc
#npc = Character("Bandit", is_player=False)
#npc.loot(laci, item=apel)  # npc langsung ambil apel
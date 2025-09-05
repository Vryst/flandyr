

class Item:
    
    def __init__(
    self,
    name,
    weight,
    width,
    height,
    depth,
    type="misc",
    desc=""):
        
        self.name = name
        self.weight = weight
        self.width = width
        self.height = height
        self.depth = depth
        self.type = type
        self.desc = desc
        
    
    def describe(self):
        return (f"Nama: {self.name}\n"
                f"Tipe: {self.type}\n"
                f"Berat: {self.weight}\n"
                f"Ukuran: {self.width}x{self.height}x{self.depth}\n"
                f"Deskripsi: {self.desc}\n")
                
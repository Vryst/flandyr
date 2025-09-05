

class Container:
    
    def __init__(
    self,
    name="dummy",
    max_weight=10,
    width=10, height=5,
    depth=10):
        
        self.name = name
        self.max_weight = max_weight
        self.width = width
        self.height = height
        self.depth = depth
        self.current_weight = 0
        self.items = []
        
    
    def can_store(self, item):
        fits_size = (item.width <= self.width and 
                     item.height <= self.height and 
                     item.depth <= self.depth)
        fits_weight = (self.current_weight + item.weight <= self.max_weight)
        return fits_size and fits_weight
    

    def add_item(self, item):
        if self.can_store(item):
            self.items.append(item)
            self.current_weight += item.weight
            return True
        return False
    

    def remove_item(self, item):
        if item in self.items:
            self.items.remove(item)
            self.current_weight -= item.weight
            return True
        return False
    
    
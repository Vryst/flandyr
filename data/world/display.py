import json

with open("dunia.json","r") as file:
    data = json.load(file)

def cetak_depth(data, indent=0):
    spasi = "    " * indent
    for k, v in data.items():
        if isinstance(v, dict):
            label = ""
            if indent == 1:
                label = ""
            elif indent == 2:
                label = ""
            elif indent == 3:
                label = ""
            print(f"{spasi}|_ {k}{label}")
            cetak_depth(v, indent + 1)
        else:
            print(f"{spasi}|_ {k}")

# Contoh pemanggilan:
cetak_depth(data["bumi"]["Benua"])





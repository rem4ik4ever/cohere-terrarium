# TERRARIUM_PACKAGES=["toolz"]

from toolz import curry

@curry
def add(a, b):
    return a + b

add5 = add(5)
print(add5(10))


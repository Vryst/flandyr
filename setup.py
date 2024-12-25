from setuptools import setup, find_packages

setup(
    name="flandyr",  # Name of your package
    version="0.5",  # Current version of your package
    packages=find_packages(),  # Automatically discover packages in the repo
    long_description=open('README.md').read(),  # Description of your project
    long_description_content_type="text/markdown",  # Specify format of README (markdown)
    author="Vryst",  # Your name or organization
    author_email="elmanuk1000@gmail.com",  # Your email
    description="Text based RPG game",  # A short description
    url="https://github.com/Vryst/flandyr",  # URL for your project
    classifiers=[  # Classifiers to help users find your project
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",  # Adjust license as needed
        "Operating System :: OS Independent",
    ],
    license="MIT",  # Adjust license as necessary (e.g., MIT, GPL)
)

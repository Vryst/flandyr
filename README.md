# Flandyr RPG

![Build Status](https://img.shields.io/github/actions/workflow/status/Vryst/flandyr/main.yml)
![License](https://img.shields.io/github/license/Vryst/flandyr)
![Version](https://img.shields.io/github/v/release/Vryst/flandyr)

Welcome to **Flandyr** :D

(this is my first game project here! please don't judge me harshly :'v)

In this game, you will fight enemies(monsters obviously, there's many tribes too that could ended up having their blod on thy sword 💀), level up, and avoid the “Game Over” screen that comes after you make a ridiculously bad decision(eating your equipment).

YOUR SUGGESTIONS IS HIGHLY NEEDED (⁠≧⁠▽⁠≦⁠)

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Contributing](#contributing)
- [License](#license)

## Introduction

The **Flandyr** is a game where players can engage in an adventure entirely through text. The world is described to the player, and they make choices to progress. There you can fight enemies, gain experience, looting theirs, upgrading your character stats, and having an interactive dialogue.

This game is perfect for those who enjoy classic RPG mechanics but without any graphical interface—everything is presented in simple text(i haven't learn to make one with GUI, well..)

## Features

- Randomly generated enemies and loot
- Multiple classes with unique abilities and unique interaction
- A simple leveling system for your character
- Many places to venture at
- Basic System<br>
   <ul type="dash">
      <li>Attack</li>
      <ul type="none">
         <li>|-- Skills</li>
         <li>|-- Spells</li>
         <li>|-- etc   </li>
      </ul>
      <li>Guard</li>
      <li>Item </li>
      <li>Escape</li>
   </ul>
- Shop that provides Potions, Supplies, and various Equipment
- Create-your-own skill (future plan)
- Easy-to-follow narrative flow with choices that affect outcomes
- **(Optional)** Save and load game functionality

## Installation

Follow these steps to set up the project locally:

1. Clone this repository:
   ```bash
   git clone https://github.com/Vryst/flandyr.git
   ```
2. Navigate into the project directory:
   ```bash
   cd flandyr
   ```
3. Create virtual environment
   ```bash
   python3 -m venv venv
   ```
4. Activate the virtual environment:
  <br>• macOS/Linux:
     ```bash
     source venv/bin/activate
     ```
   • Windows:
     ```bash
     .\venv\Scripts\activate
     ```

5. Set project root
  ```bash
  export PYTHONPATH=$(pwd):$PYTHONPATH
  ```

6. Install the setup
  ```bash
  pip install -e .
  ```

7. Install the required dependencies:
  ```bash
  pip install -r requirements.txt
  ```

8. Navigate to the main script
  ```bash
  cd main/game
  ```

9. Run the game :D
  ```bash
  python view.py
  ```

## Contributing

Contributions are welcome! To contribute to this project, follow these steps:

1. Fork the repository to your own GitHub account.

2. Clone your fork to your local machine:
   ```bash
   git clone https://github.com/Vryst/flandyr.git
   ```

3. Create a new branch:
   ```bash
   git checkout -b feature-name
   ```

4. Make your changes and commit them:
   ```bash
   git commit -m "Description of your changes"
   ```

5. Push your changes to your fork:
   ```bash
   git push origin feature-name
   ```

6. Open a pull request on GitHub.

## LICENSE

This project is licensed under the GNU General Public License v2.0 - see the LICENSE file for details.


## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Contributing](#contributing)
- [License](#license)

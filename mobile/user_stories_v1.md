# Elementle Mobile App - User Stories

This document defines the user stories for the React Native (Expo) implementation of Elementle, based on the analysis of the existing web application and detailed user feedback.

## 1. Home Screen & Navigation

**User Story 1.1: Home Layout & Cards**
As a user, I want to see a clean, card-based home screen so that I can easily access the main features.
*   **Acceptance Criteria:**
    *   Display a header with "Elementle" title, Help icon (left), and Settings icon (right).
    *   Show a "Mode Toggle" (UK Edition / User Name) that switches themes.
    *   Display four main cards with "Hammie" mascots:
        1.  **Play Today's Puzzle**: Large primary action card.
        2.  **Archive**: Access to past puzzles.
        3.  **Stats**: View personal or regional statistics.
        4.  **Options**: Quick access to game settings.
    *   Cards should use rounded corners ("3xl"-like) and shadows consistent with the web design.

**User Story 1.2: Dual Game Modes (UK vs User)**
As a user, I want to switch between "UK Edition" and my "Personal" mode so that I can play different sets of puzzles.
*   **Acceptance Criteria:**
    *   Implement a toggle switch at the top of the Home screen.
    *   **Animation Sync**: The toggle must animate smoothly from side to side. Crucially, this animation must be **synchronized** with the user scrolling the screen left/right to switch between the "Region" (UK) and "User" game modes.
    *   **UK Edition Mode**:
        *   Theme: Blue/Yellow color scheme.
        *   Data: Loads global/regional puzzles.
    *   **User Mode**:
        *   Theme: Teal/Orange color scheme.
        *   Data: Loads personalized puzzles based on user interests.
    *   The "Stats" card text should update to "UK Stats" or "Your Stats" respectively.

## 2. Gameplay Experience

**User Story 2.1: Puzzle Entry & Input**
As a user, I want a responsive input grid so that I can enter dates with clear visual feedback.
*   **Acceptance Criteria:**
    *   Display a 6x8 or similar grid (DD MM YYYY or DD MM YY).
    *   **Input Animation**: When a digit is entered, the target box should:
        *   Show a **bold, black border**.
        *   Animate slightly larger (scale up) and then quickly return to normal size (pulse effect).
    *   Show a custom on-screen numeric keypad (0-9) with Enter and Backspace (icon).
    *   Entered digits fill slots sequentially.

**User Story 2.2: Guess Validation & Feedback**
As a user, I want precise feedback on my guesses to help me solve the puzzle.
*   **Acceptance Criteria:**
    *   **Invalid Guess**: Shake row and alert "Invalid Date" for non-existent dates.
    *   **Valid Guess (Submission)**:
        *   **Green**: Correct digit in correct position.
        *   **Amber**: Correct digit in wrong position. **Must show a small Arrow** (Higher/Lower) indicating the direction of the correct digit relative to the entered one (or position hint if applicable).
        *   **Grey**: Digit not in the date.
    *   Animate tiles flipping/changing color sequentially.

**User Story 2.3: Winning & Badges**
As a user, I want to be rewarded for my achievements with badges and streaks.
*   **Acceptance Criteria:**
    *   **Badges**:
        *   Award **"Elementle in 1"** badge for a perfect first guess.
        *   Award **Streak Milestone** badges (e.g., 7 days in a row) upon winning.
    *   Trigger "Streak Started!" or "Streak Continued!" popup with "Fire Hamster" animation.
    *   Auto-transition to End Game Modal.

**User Story 2.4: End Game Modal**
As a user, I want to see my results and validation.
*   **Acceptance Criteria:**
    *   Modal must show:
        *   Hamster placeholder image (Win/Lose specific images to be added later).
        *   Event Title and Description.
        *   Guess count (e.g., "1/6").
        *   Buttons: "**Stats**", "**Home**", "**Archive**".

## 3. Archive & History

**User Story 3.1: Calendar Navigation**
As a user, I want to navigate through past puzzles grid-by-grid using swipe gestures.
*   **Acceptance Criteria:**
    *   Show a **Month View** calendar (only days in that month).
    *   Allow **Horizontal Drag/Swipe** to move between months.
    *   **Constraints**:
        *   Cannot swipe forward past the current month.
        *   Cannot swipe back past months where no questions were allocated to the user.

**User Story 3.2: Reviewing Games**
As a user, I want to review my past games with a visual playback.
*   **Acceptance Criteria:**
    *   **Completed (Green) Games**:
        *   Clicking opens the grid.
        *   **Animation**: The grid should "fill out" smoothly, with numbers and colors reappearing (replay effect).
        *   Show a **"Continue"** button at the bottom to proceed to the EndGameModal/Summary.
    *   **In-Progress (Blue) Games**:
        *   Resumes the game state exactly where left off.
        *   **Digit Lock**: User **cannot** change the 6/8 digit mode setting if a game is already in progress.

## 4. Settings & Pro Features

**User Story 4.1: Settings & Feature Gating**
As a user, I want to see options contextually based on my subscription status.
*   **Acceptance Criteria:**
    *   **Standard User**:
        *   Show "Go Pro" option.
        *   Hide "Select Categories".
    *   **Pro User**:
        *   Show "Pro" (Manage Subscription).
        *   Show "**Select Categories**" (Topics like Anime, History).
    *   **Admin User**:
        *   Show "**Admin**" menu option.

**User Story 4.2: Options & Preferences**
As a user, I want to configure game behavior and tools.
*   **Acceptance Criteria:**
    *   **Streak Saver**: Toggle on/off (Standard & Pro).
    *   **Holiday Protection**: Toggle on/off (Pro/Education only).
    *   **Date Format**: Toggle 6/8 digits. *Constraint: Disabled if current game is in progress.*
    *   **Clues**: Toggle on/off.
    *   **Dark Mode**: Toggle.

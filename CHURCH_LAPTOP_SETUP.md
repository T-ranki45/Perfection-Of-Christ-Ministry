# Church Laptop Setup (ICT App)

This file captures the install and run steps so you can use them later on the church laptop.

## Option A: Run the Desktop App (Recommended)
1. Install Node.js LTS on the church laptop.
2. Copy the entire project folder to the church laptop.
3. Open PowerShell in the project folder:
   - In File Explorer, open the folder.
   - Hold Shift, right-click, choose "Open PowerShell window here".
4. Install dependencies (first time only):
   ```powershell
   npm install
   ```
5. Start the ICT desktop app:
   ```powershell
   npm run app
   ```

## Option B: No Internet on the Church Laptop
1. On another PC with internet, run this inside the project folder:
   ```powershell
   npm install
   ```
2. Copy the entire folder (including node_modules) to the church laptop.
3. On the church laptop, run:
   ```powershell
   npm run app
   ```

## What the App Does
- Starts the local server automatically.
- Opens ICT in a standalone window (no browser tabs).

## Two-Laptop Connectivity (Control + Receiver)
Use this when your laptop is the control panel and the church laptop drives the big screen.

### Option A: Church Laptop Hosts the Server (Receiver host)
1. Connect both laptops to the same Wi-Fi or phone hotspot.
2. On the church laptop, run:
   ```powershell
   npm start
   ```
3. On the church laptop, open:
   ```text
   http://localhost:3000/screen.html
   ```
   Press F11 for full screen.
4. On your laptop, open:
   ```text
   http://CHURCH_LAPTOP_IP:3000/ict.html
   ```

### Option B: Your Laptop Hosts the Server (Control host)
1. Connect both laptops to the same Wi-Fi or phone hotspot.
2. On your laptop, run:
   ```powershell
   npm start
   ```
3. On your laptop, open:
   ```text
   http://localhost:3000/ict.html
   ```
4. On the church laptop, open:
   ```text
   http://YOUR_LAPTOP_IP:3000/screen.html
   ```
   Press F11 for full screen.

### How to Find IP Address (Windows)
1. Open PowerShell.
2. Run:
   ```powershell
   ipconfig
   ```
3. Find the line called IPv4 Address (example: 192.168.1.50).

### Firewall Note
If Windows asks, allow access on Private Networks.

## One-Laptop Live Usage
- Keep ict.html open for controls.
- Open screen.html full screen (F11) for the audience.
- Use Alt+Tab to switch.
- Audience View button hides controls from the congregation.

## Hotkeys (Fast Control)
- B = Blank screen (panic)
- V = Verse mode
- L = Lyrics mode
- Arrow keys = Previous/Next slide

## Offline Behavior
- The last screen state is cached locally.
- If internet drops, ict.html and screen.html still work on the same laptop.
- Bible lookup and hymn search need internet, but cached verses still work.

## Optional: Package as a Windows Installer
If you want a single .exe installer, ask and we can set it up (Electron packaging).

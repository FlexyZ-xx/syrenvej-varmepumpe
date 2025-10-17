# Save Relay Board Image

## Instructions

Please save the relay board photo you shared in the chat as:

```
images/relay-board.jpg
```

### Steps:

1. Right-click on the relay board image in the chat
2. Choose "Save Image As..."
3. Navigate to: `/Users/felixn/git/syrenvej/syrenvej.ino/cloud/images/`
4. Save as: `relay-board.jpg`

### Alternative (Command Line):

If you have the image file already saved somewhere, you can copy it:

```bash
cp /path/to/your/relay-photo.jpg /Users/felixn/git/syrenvej/syrenvej.ino/cloud/images/relay-board.jpg
```

### After Saving:

Run these commands to add it to git:

```bash
cd /Users/felixn/git/syrenvej/syrenvej.ino/cloud
git add images/relay-board.jpg
git commit -m "Add relay board hardware photo"
git push origin main
```

The image is now referenced in these documentation files:
- README.md
- WIRING.md  
- ESP32_SETUP.md

Once you add the image file, it will display automatically in the documentation!

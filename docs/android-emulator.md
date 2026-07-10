# Android Emulator

## Using The Android Emulator

If you test the app in an Android emulator, `localhost` inside the emulator means the emulator itself, not your computer.

Use this address instead:

```text
http://10.0.2.2:3001
```

The backend must still be running on your computer.

If you serve the frontend separately, for example, from:

```text
http://10.0.2.2:5500
```

the frontend will call the backend at:

```text
http://10.0.2.2:3001
```

For a real phone, connect the phone and computer to the same Wi-Fi network and use the computer's local network IP address instead of `localhost`.

# WLAN & Local Network Testing Guide

Testing WebRTC across devices (e.g., Laptop and Mobile) on the same WiFi network is crucial for verifying your implementation.

## Step-by-Step Instructions

1.  **Start the Signaling Server**:
    Run your NestJS backend on your laptop.
    ```bash
    npm run start:dev
    ```

2.  **Detect Laptop's LAN IP**:
    On Windows (Powershell): `ipconfig` -> Look for `IPv4 Address` under Wireless LAN adapter.
    On macOS/Linux: `ifconfig` or `ip addr`.
    *Example: 192.168.1.25*

3.  **Configure Frontend Environment**:
    In your `frontend/.env` file:
    ```env
    VITE_SIGNALING_SERVER=http://192.168.1.25:3000
    VITE_USE_WLAN_TUNNEL=true
    ```

4.  **Connect Mobile Device**:
    - Ensure your mobile phone is on the **same WiFi network** as your laptop.
    - Open the mobile browser and navigate to `http://192.168.1.25:5173` (or your Vite port).

5.  **Join a Meeting**:
    - Create a meeting on your laptop.
    - Enter the same meeting code on your mobile device.

6.  **Verify WebRTC Connection**:
    - Check the browser console on your laptop for debug logs:
      `[WebRTC] WLAN Tunnel MODE: ENABLED`
    - Verify that audio and video are streaming correctly between both devices.

## Troubleshooting
- **Firewall**: Ensure your laptop's firewall allows incoming connections on the signaling server port (3000) and the Vite port (5173).
- **HTTPS**: Some mobile browsers (like Chrome on Android or Safari on iOS) strictly require **HTTPS** for camera/mic access unless you are on `localhost`. Over WiFi, you might need to use a tool like `mkcert` or access via `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.

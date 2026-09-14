# MediaPipe Hand Landmarker asset

Unmodified pretrained Google MediaPipe float16 Hand Landmarker, version 1.
This is a public model, not David's training data or a custom-trained model.

- Source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- SHA-256: fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1
- Size: 7,819,105 bytes. Verified against the versioned upstream download on 2026-09-13.
- Model guide: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/index
- Model card (license and limitations): https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20(Lite_Full)%20with%20Fairness%20Oct%202021.pdf
- License: Apache-2.0; included in public/licenses/mediapipe-apache-2.0.txt.

The JS and WASM runtime come from the exact locked @mediapipe/tasks-vision 1.0.1
package, not a CDN. Vite emits all runtime/model files as content-hashed assets.
Only the on-demand worker imports them, after the visitor requests camera access.

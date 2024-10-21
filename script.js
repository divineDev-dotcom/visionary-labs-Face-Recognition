let videoElement = document.getElementById('video');
let captureBtn = document.getElementById('capture-btn');
let startDetectionBtn = document.getElementById('start-detection-btn');
let switchCameraBtn = document.getElementById('switch-camera-btn');

let knownFaces = JSON.parse(localStorage.getItem('knownFaces')) || []; // Load known faces from localStorage
let currentStream = null;
let isRearCamera = false;

// Bootstrap modal instance
let faceModal = new bootstrap.Modal(document.getElementById('faceModal'));
let saveFaceBtn = document.getElementById('save-face-btn');

// Start the camera with the appropriate facing mode
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  const constraints = {
    video: {
      facingMode: isRearCamera ? { exact: "environment" } : "user"
    }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = currentStream;
    speak("Camera started.");
  } catch (err) {
    speak("Error accessing camera. Please check your settings.");
    console.error("Error accessing camera:", err);
  }
}

// Switch between front and rear camera
function switchCamera() {
  isRearCamera = !isRearCamera;
  startCamera();
}

switchCameraBtn.addEventListener('click', () => {
  switchCamera();
  speak("Switching camera.");
});

// Load face-api models
async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
  speak("Models loaded.");
}

// Detect faces from the video
async function detectFaces() {
  const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
                                    .withFaceLandmarks().withFaceDescriptors();
  return detections;
}

// Capture face and show Bootstrap modal for details
function captureFace() {
  detectFaces().then(detections => {
    if (detections.length > 0) {
      speak("Face detected.");
      const faceData = detections[0].descriptor;

      // Open the modal to ask for name and relation
      faceModal.show();
      speak("Please enter the name and relation for the captured face.");

      // Handle saving face details
      saveFaceBtn.onclick = function () {
        const name = document.getElementById('name').value;
        const relation = document.getElementById('relation').value;

        if (name && relation) {
          knownFaces.push({ name, relation, faceData });
          localStorage.setItem('knownFaces', JSON.stringify(knownFaces));  // Save to localStorage

          // Close modal and reset form
          faceModal.hide();
          document.getElementById('face-details-form').reset();
          speak(`Face saved for ${relation} ${name}.`);
        } else {
          speak("Please fill out both name and relation fields.");
        }
      };
    } else {
      speak("No face detected. Please try again.");
    }
  });
}

// Start looking around for faces
async function startLookingAround() {
  speak("Looking for faces.");
  setInterval(async () => {
    const detections = await detectFaces();

    if (detections.length > 0) {
      detections.forEach(detection => {
        const faceData = detection.descriptor;

        knownFaces.forEach(savedFace => {
          const distance = faceapi.euclideanDistance(savedFace.faceData, faceData);
          if (distance < 0.6) {  // A threshold for similarity
            speak(`${savedFace.relation}, ${savedFace.name}, detected.`);
          }
        });
      });
    }
  }, 1000);
}

// Speak the identified person's name and relation
function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(msg);
}

captureBtn.addEventListener('click', captureFace);
startDetectionBtn.addEventListener('click', startLookingAround);

// Start camera and load models on page load
window.onload = async function () {
  await loadModels();
  startCamera();
};

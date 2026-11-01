export class AudioRecorder {
    static async start() {
        // Keeps track of all the audio chunks
        const chunks = [];

        // Start recording
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(mediaStream);
        mediaRecorder.addEventListener('dataavailable', (event) => chunks.push(event.data));
        mediaRecorder.start();

        // Stop callback
        const stop = () => {
            return new Promise((resolve) => {
                // Create the blob/uri/audio once the recording actually stops
                mediaRecorder.addEventListener('stop', () => {
                    // The upload needs the type to accept the file
                    const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
                    const uri = URL.createObjectURL(blob);
                    const audio = new Audio(uri);
                    mediaStream.getTracks().forEach((t) => t.stop());
                    resolve({ blob, uri, audio });
                });

                // Stop the recording
                mediaRecorder.stop();
            });
        };

        return stop;
    }
}

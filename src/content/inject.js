// This script runs in the main page context to access window objects like ytInitialPlayerResponse
(function () {
    console.log('YT2Anki Inject Script Running');

    function getCaptions() {
        if (!window.ytInitialPlayerResponse ||
            !window.ytInitialPlayerResponse.captions ||
            !window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer ||
            !window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks) {
            return [];
        }
        return window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
    }

    // Send captions to content script
    // We need to make sure we are sending the full object
    // Sometimes the 'baseUrl' in the track object is what we need, but maybe we need other params?
    const tracks = getCaptions();
    console.log("YT2Anki: Inject found tracks:", tracks);
    window.postMessage({ type: "YT2ANKI_TRACKS", tracks: tracks }, "*");
})();

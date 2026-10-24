package tv.five.fire;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.KeyEvent;
import android.view.SurfaceView;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

public final class MainActivity extends Activity {
    private static final String ITVX_PACKAGE = "air.ITVMobilePlayer";
    private static final String HELPER_ORIGIN = "http://127.0.0.1:4186";
    private static final String TAG = "FiveFireTV";
    private WebView webView;
    private ExoPlayer player;
    private final ExecutorService helperRequests = Executors.newSingleThreadExecutor();
    private final AtomicLong playbackGeneration = new AtomicLong();
    private volatile boolean textEntryActive = false;
    private volatile boolean youtubeRemoteControl = false;
    private boolean waitingForITVX = false;
    private boolean resumePlayback = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUi();

        FrameLayout root = new FrameLayout(this);
        SurfaceView videoSurface = new SurfaceView(this);
        videoSurface.setFocusable(false);
        videoSurface.setSecure(true);

        player = new ExoPlayer.Builder(this).build();
        player.setVideoSurfaceView(videoSurface);
        player.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (isPlaying) {
                    Log.i(TAG, "Native video playback started");
                    evaluate("window.fireTVPlaybackStarted && window.fireTVPlaybackStarted()");
                }
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                Log.e(TAG, "Native video playback failed", error);
                evaluate("window.fireTVPlaybackFailed && window.fireTVPlaybackFailed()");
            }
        });

        root.addView(videoSurface, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.addJavascriptInterface(new FireTVBridge(), "FiveFireTV");
        webView.setWebChromeClient(new WebChromeClient());
        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    @Override
    protected void onPause() {
        resumePlayback = player != null && player.isPlaying();
        if (player != null) player.pause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
        if (waitingForITVX && webView != null) {
            waitingForITVX = false;
            webView.postDelayed(() -> evaluate(
                    "window.fireTVResume && window.fireTVResume()"), 250);
        } else if (resumePlayback && player != null) {
            resumePlayback = false;
            player.play();
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        if (youtubeRemoteControl && isYoutubeNavigationKey(keyCode)) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                evaluate("window.fireTVRevealNostalgiaOverlay && window.fireTVRevealNostalgiaOverlay()");
            }
            return super.dispatchKeyEvent(event);
        }
        if (textEntryActive && (isChannelNumberKey(keyCode)
                || keyCode == KeyEvent.KEYCODE_DPAD_UP
                || keyCode == KeyEvent.KEYCODE_DPAD_DOWN)) {
            return super.dispatchKeyEvent(event);
        }
        String script = remoteKeyScript(keyCode);
        if (script == null) return super.dispatchKeyEvent(event);

        if (event.getAction() == KeyEvent.ACTION_DOWN
                && !event.isCanceled()
                && (isVolumeKey(keyCode)
                || keyCode == KeyEvent.KEYCODE_DPAD_UP
                || keyCode == KeyEvent.KEYCODE_DPAD_DOWN
                || event.getRepeatCount() == 0)) {
            evaluate(script);
        }
        return true;
    }

    private boolean isVolumeKey(int keyCode) {
        return keyCode == KeyEvent.KEYCODE_VOLUME_UP
                || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
                || keyCode == KeyEvent.KEYCODE_VOLUME_MUTE
                || keyCode == KeyEvent.KEYCODE_MUTE;
    }

    private boolean isChannelNumberKey(int keyCode) {
        return (keyCode >= KeyEvent.KEYCODE_1 && keyCode <= KeyEvent.KEYCODE_5)
                || (keyCode >= KeyEvent.KEYCODE_NUMPAD_1 && keyCode <= KeyEvent.KEYCODE_NUMPAD_5);
    }

    private boolean isYoutubeNavigationKey(int keyCode) {
        return keyCode == KeyEvent.KEYCODE_DPAD_UP
                || keyCode == KeyEvent.KEYCODE_DPAD_DOWN
                || keyCode == KeyEvent.KEYCODE_DPAD_LEFT
                || keyCode == KeyEvent.KEYCODE_DPAD_RIGHT
                || keyCode == KeyEvent.KEYCODE_DPAD_CENTER
                || keyCode == KeyEvent.KEYCODE_ENTER;
    }

    private String remoteKeyScript(int keyCode) {
        if (keyCode >= KeyEvent.KEYCODE_1 && keyCode <= KeyEvent.KEYCODE_5) {
            return "window.fireTVRemoteChannel && window.fireTVRemoteChannel(" + (keyCode - KeyEvent.KEYCODE_1 + 1) + ")";
        }
        if (keyCode >= KeyEvent.KEYCODE_NUMPAD_1 && keyCode <= KeyEvent.KEYCODE_NUMPAD_5) {
            return "window.fireTVRemoteChannel && window.fireTVRemoteChannel(" + (keyCode - KeyEvent.KEYCODE_NUMPAD_1 + 1) + ")";
        }
        if (keyCode == KeyEvent.KEYCODE_DPAD_UP) {
            return "window.fireTVRemoteNavigate && window.fireTVRemoteNavigate(-1)";
        }
        if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN) {
            return "window.fireTVRemoteNavigate && window.fireTVRemoteNavigate(1)";
        }
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            return "window.fireTVRemoteVolume && window.fireTVRemoteVolume(1)";
        }
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            return "window.fireTVRemoteVolume && window.fireTVRemoteVolume(-1)";
        }
        if (keyCode == KeyEvent.KEYCODE_VOLUME_MUTE || keyCode == KeyEvent.KEYCODE_MUTE) {
            return "window.fireTVRemoteMute && window.fireTVRemoteMute()";
        }
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER
                || keyCode == KeyEvent.KEYCODE_ENTER
                || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER) {
            return "window.fireTVRemoteSelect && window.fireTVRemoteSelect()";
        }
        return null;
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            returnToOmarchy();
            return;
        }
        webView.evaluateJavascript(
                "window.fireTVHandleBack ? window.fireTVHandleBack() : false",
                handled -> {
                    if (!"true".equals(handled)) returnToOmarchy();
                });
    }

    private void returnToOmarchy() {
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        home.setClassName("com.omarchytv.home", "com.omarchytv.home.MainActivity");
        home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try {
            startActivity(home);
        } catch (RuntimeException error) {
            Log.e(TAG, "Could not return to Omarchy TV", error);
        }
        finish();
    }

    @Override
    protected void onDestroy() {
        helperRequests.shutdownNow();
        if (webView != null) {
            webView.removeJavascriptInterface("FiveFireTV");
            webView.destroy();
            webView = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }

    private void evaluate(String script) {
        if (webView != null) webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private JSONObject helperJson(String path, String method, String key)
            throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(HELPER_ORIGIN + path).openConnection();
        connection.setConnectTimeout(18000);
        connection.setReadTimeout(18000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json");
        if (key != null) connection.setRequestProperty("X-Five-Key", key);
        if ("POST".equals(method)) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.getOutputStream().close();
        }
        try {
            int responseCode = connection.getResponseCode();
            InputStream stream = responseCode >= 400 ? connection.getErrorStream() : connection.getInputStream();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            if (stream != null) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = stream.read(buffer)) != -1) output.write(buffer, 0, count);
                stream.close();
            }
            JSONObject result = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
            if (responseCode < 200 || responseCode >= 300) {
                throw new IOException(result.optString("error", "Local playback helper returned HTTP " + responseCode));
            }
            return result;
        } finally {
            connection.disconnect();
        }
    }

    private void startPlayback(MediaItem mediaItem, long requestId) {
        if (player == null || playbackGeneration.get() != requestId) return;
        try {
            player.setMediaItem(mediaItem);
            player.prepare();
            player.play();
        } catch (RuntimeException error) {
            Log.e(TAG, "Could not start media playback", error);
            evaluate("window.fireTVPlaybackFailed && window.fireTVPlaybackFailed()");
        }
    }

    private final class FireTVBridge {
        @JavascriptInterface
        public void setYoutubeRemoteControl(boolean active) {
            youtubeRemoteControl = active;
        }

        @JavascriptInterface
        public void setTextEntryActive(boolean active) {
            textEntryActive = active;
        }

        @JavascriptInterface
        public void play(String address) {
            long requestId = playbackGeneration.incrementAndGet();
            runOnUiThread(() -> {
                Uri uri = Uri.parse(address);
                if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                    evaluate("window.fireTVPlaybackFailed && window.fireTVPlaybackFailed()");
                    return;
                }
                startPlayback(MediaItem.fromUri(uri), requestId);
            });
        }

        @JavascriptInterface
        public void playProtectedChannel(int channel) {
            if (channel != 4 && channel != 5) return;
            long requestId = playbackGeneration.incrementAndGet();
            helperRequests.execute(() -> {
                try {
                    JSONObject status = helperJson("/api/status", "GET", null);
                    String key = status.optString("code", "");
                    if (key.isEmpty()) throw new IOException("Local playback helper has no session code");
                    JSONObject playback = helperJson("/api/c" + channel + "/play", "POST", key);
                    String manifest = playback.getString("manifest");
                    String licencePath = playback.getString("licence");
                    Uri licenceUri = Uri.parse(HELPER_ORIGIN + licencePath);
                    MediaItem.DrmConfiguration drm = new MediaItem.DrmConfiguration.Builder(C.WIDEVINE_UUID)
                            .setLicenseUri(licenceUri)
                            .setLicenseRequestHeaders(Collections.singletonMap("X-Five-Key", key))
                            .build();
                    MediaItem mediaItem = new MediaItem.Builder()
                            .setUri(manifest)
                            .setDrmConfiguration(drm)
                            .build();
                    runOnUiThread(() -> startPlayback(mediaItem, requestId));
                } catch (Exception error) {
                    Log.e(TAG, "Channel " + channel + " setup failed: " + error.getMessage());
                    runOnUiThread(() -> {
                        if (playbackGeneration.get() == requestId) {
                            evaluate("window.fireTVPlaybackFailed && window.fireTVPlaybackFailed()");
                        }
                    });
                }
            });
        }

        @JavascriptInterface
        public void stop() {
            playbackGeneration.incrementAndGet();
            runOnUiThread(() -> {
                if (player != null) {
                    player.stop();
                    player.clearMediaItems();
                }
            });
        }

        @JavascriptInterface
        public void pause() {
            runOnUiThread(() -> {
                if (player != null) player.pause();
            });
        }

        @JavascriptInterface
        public void resume() {
            runOnUiThread(() -> {
                if (player != null) player.play();
            });
        }

        @JavascriptInterface
        public void setVolume(float volume) {
            runOnUiThread(() -> {
                if (player != null) player.setVolume(Math.max(0f, Math.min(1f, volume)));
            });
        }

        @JavascriptInterface
        public void setMuted(boolean muted) {
            runOnUiThread(() -> {
                if (player != null) player.setVolume(muted ? 0f : 1f);
            });
        }

        @JavascriptInterface
        public void openITVX() {
            runOnUiThread(() -> {
                PackageManager packages = getPackageManager();
                Intent launch = packages.getLaunchIntentForPackage(ITVX_PACKAGE);
                if (launch == null) {
                    Toast.makeText(MainActivity.this,
                            "Install the official ITVX app from the Fire TV Appstore first.",
                            Toast.LENGTH_LONG).show();
                    return;
                }
                waitingForITVX = true;
                try {
                    startActivity(launch);
                } catch (Exception error) {
                    waitingForITVX = false;
                    Toast.makeText(MainActivity.this,
                            "Could not open ITVX on this Fire TV device.",
                            Toast.LENGTH_LONG).show();
                }
            });
        }
    }
}

package in.shaasthi.pilot;

import android.content.Context;
import com.facebook.react.ReactInstanceManager;

public final class ReactNativeFlipper {
  private ReactNativeFlipper() {}

  public static void initializeFlipper(Context context, ReactInstanceManager reactInstanceManager) {
    // Expo dev-client probes this class by reflection; the app does not rely on Flipper.
  }
}

import NetInfo from "@react-native-community/netinfo";

export function subscribeConnectivity(onChange) {
  return NetInfo.addEventListener((state) => {
    const online = Boolean(state.isConnected && (state.isInternetReachable === true || state.isInternetReachable == null));
    onChange(online, state);
  });
}

export async function fetchIsOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && (state.isInternetReachable === true || state.isInternetReachable == null));
}

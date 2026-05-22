const { spawnSync } = require("child_process");

function listAdbDevices(adb, env) {
  const result = spawnSync(adb, ["devices", "-l"], { env, encoding: "utf8" });
  if (result.status !== 0) {
    return {
      devices: [],
      error: (result.stderr || result.stdout || "adb devices failed").trim(),
    };
  }

  const devices = (result.stdout || "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state, ...detailParts] = line.split(/\s+/);
      const details = {};
      for (const part of detailParts) {
        const [key, value] = part.split(":");
        if (key && value) details[key] = value;
      }
      return {
        serial,
        state,
        model: details.model,
        product: details.product,
        device: details.device,
      };
    });

  return { devices, error: null };
}

function readyDevices(devices) {
  return devices.filter((device) => device.state === "device");
}

function formatDevice(device) {
  const model = device.model ? ` ${device.model}` : "";
  return `${device.serial}${model}`;
}

function selectDevice(devices, requestedSerial) {
  if (requestedSerial) {
    return {
      device: devices.find((device) => device.serial === requestedSerial) || null,
      ambiguous: false,
    };
  }

  const physicalDevices = devices.filter((device) => !device.serial.startsWith("emulator-"));
  const candidates = physicalDevices.length > 0 ? physicalDevices : devices;
  return {
    device: candidates[0] || null,
    ambiguous: candidates.length > 1,
  };
}

module.exports = {
  formatDevice,
  listAdbDevices,
  readyDevices,
  selectDevice,
};

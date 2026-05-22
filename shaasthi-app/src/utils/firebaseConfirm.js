let _confirmationResult = null;

export function setConfirmationResult(cr) {
  _confirmationResult = cr;
}

export function getConfirmationResult() {
  return _confirmationResult;
}

export function clearConfirmationResult() {
  _confirmationResult = null;
}

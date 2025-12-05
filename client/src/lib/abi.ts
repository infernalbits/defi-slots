export const CONTRACT_ADDRESS = "0x..."; // REPLACE THIS WITH YOUR DEPLOYED CONTRACT ADDRESS

export const CONTRACT_ABI = [
  "function spin() external payable",
  "function depositHouse() external payable",
  "function getHouseStats() external view returns (uint256, uint256, uint256)",
  "function shares(address) external view returns (uint256)",
  "event Spin(address indexed player, uint256 bet, uint256 outcome, uint256 payout)",
  "error InsufficientPoolBalance()",
  "error BetTooHigh()",
  "error BetTooLow()",
  "error TransferFailed()"
];

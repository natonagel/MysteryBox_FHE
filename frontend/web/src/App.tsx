import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface SubscriptionBox {
  id: string;
  name: string;
  category: string;
  encryptedPreference: string;
  publicValue1: number;
  publicValue2: number;
  description: string;
  creator: string;
  timestamp: number;
  isVerified: boolean;
  decryptedValue: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionBox[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingSubscription, setCreatingSubscription] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newSubscriptionData, setNewSubscriptionData] = useState({ 
    name: "", 
    category: "electronics", 
    preference: "", 
    description: "" 
  });
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionBox | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [operationHistory, setOperationHistory] = useState<string[]>([]);
  const [showFAQ, setShowFAQ] = useState(false);
  const [stats, setStats] = useState({ total: 0, verified: 0, avgPreference: 0 });

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized) return;
      
      try {
        console.log('Initializing FHEVM for confidential subscription...');
        await initialize();
        console.log('FHEVM initialized successfully');
        addToHistory("FHE System Initialized");
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize]);

  useEffect(() => {
    const loadData = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadSubscriptions();
        const contract = await getContractReadOnly();
        if (contract) {
          await checkAvailability();
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isConnected]);

  const addToHistory = (action: string) => {
    setOperationHistory(prev => [`${new Date().toLocaleTimeString()}: ${action}`, ...prev.slice(0, 9)]);
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractWithSigner();
      if (!contract) return;
      
      const tx = await contract.isAvailable();
      await tx.wait();
      addToHistory("System Availability Checked");
      setTransactionStatus({ visible: true, status: "success", message: "System is available!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (error) {
      console.error('Availability check failed:', error);
    }
  };

  const loadSubscriptions = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const subscriptionsList: SubscriptionBox[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          subscriptionsList.push({
            id: businessId,
            name: businessData.name,
            category: getCategoryFromValue(businessData.publicValue1),
            encryptedPreference: "🔒 Encrypted",
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            description: businessData.description,
            creator: businessData.creator,
            timestamp: Number(businessData.timestamp),
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading subscription data:', e);
        }
      }
      
      setSubscriptions(subscriptionsList);
      updateStats(subscriptionsList);
      addToHistory(`Loaded ${subscriptionsList.length} subscriptions`);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load subscriptions" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const updateStats = (subs: SubscriptionBox[]) => {
    const total = subs.length;
    const verified = subs.filter(s => s.isVerified).length;
    const avgPreference = total > 0 ? subs.reduce((sum, s) => sum + s.publicValue1, 0) / total : 0;
    setStats({ total, verified, avgPreference });
  };

  const getCategoryFromValue = (value: number): string => {
    const categories = ["electronics", "fashion", "books", "food", "beauty", "sports"];
    return categories[value % categories.length] || "general";
  };

  const createSubscription = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingSubscription(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating confidential subscription..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const preferenceValue = parseInt(newSubscriptionData.preference) || 0;
      const categoryValue = getCategoryValue(newSubscriptionData.category);
      const businessId = `subscription-${Date.now()}`;
      
      const encryptedResult = await encrypt(await contract.getAddress(), address, preferenceValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newSubscriptionData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        categoryValue,
        0,
        newSubscriptionData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Encrypting preferences..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Subscription created with FHE protection!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadSubscriptions();
      setShowCreateModal(false);
      setNewSubscriptionData({ name: "", category: "electronics", preference: "", description: "" });
      addToHistory(`Created subscription: ${newSubscriptionData.name}`);
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingSubscription(false); 
    }
  };

  const getCategoryValue = (category: string): number => {
    const categories: { [key: string]: number } = {
      "electronics": 1, "fashion": 2, "books": 3, "food": 4, "beauty": 5, "sports": 6
    };
    return categories[category] || 0;
  };

  const decryptPreference = async (subscriptionId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const subscriptionData = await contractRead.getBusinessData(subscriptionId);
      if (subscriptionData.isVerified) {
        const storedValue = Number(subscriptionData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Preference already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        addToHistory(`Viewed verified preference: ${storedValue}`);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(subscriptionId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        await contractWrite.getAddress(),
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(subscriptionId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Homomorphically matching preferences..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadSubscriptions();
      
      setTransactionStatus({ visible: true, status: "success", message: "Preference decrypted and verified!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      addToHistory(`Decrypted preference: ${clearValue}`);
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Preference already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadSubscriptions();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sub.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || sub.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", "electronics", "fashion", "books", "food", "beauty", "sports"];

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>🎁 Confidential Subscription Box</h1>
            <p>FHE-Protected Mystery Shopping</p>
          </div>
          <ConnectButton />
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🔐</div>
            <h2>Connect to Unlock Private Preferences</h2>
            <p>Your shopping preferences are encrypted with FHE technology - only you can decrypt them!</p>
            <div className="feature-grid">
              <div className="feature-card">
                <span>🔒</span>
                <h3>Encrypted Preferences</h3>
                <p>Your likes and dislikes stay private</p>
              </div>
              <div className="feature-card">
                <span>🎯</span>
                <h3>Smart Matching</h3>
                <p>Homomorphic matching without revealing data</p>
              </div>
              <div className="feature-card">
                <span>🎁</span>
                <h3>Surprise Boxes</h3>
                <p>Get perfectly matched mystery items</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption...</p>
        <p className="loading-note">Securing your shopping preferences</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading your mystery boxes...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <h1>🎁 Confidential Subscription Box</h1>
          <p>FHE-Protected • Your Preferences Stay Encrypted</p>
        </div>
        
        <div className="header-actions">
          <button onClick={() => setShowFAQ(true)} className="nav-btn">FAQ</button>
          <button onClick={checkAvailability} className="nav-btn">Check System</button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">+ New Box</button>
          <ConnectButton />
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Boxes</h3>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <h3>Verified Preferences</h3>
          <div className="stat-value">{stats.verified}</div>
        </div>
        <div className="stat-card">
          <h3>Avg Preference Score</h3>
          <div className="stat-value">{stats.avgPreference.toFixed(1)}</div>
        </div>
      </div>

      <div className="controls-section">
        <div className="search-filter">
          <input 
            type="text" 
            placeholder="🔍 Search subscriptions..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="filter-select"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === "all" ? "All Categories" : cat}</option>
            ))}
          </select>
          <button onClick={loadSubscriptions} disabled={isRefreshing} className="refresh-btn">
            {isRefreshing ? "🔄" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="subscriptions-grid">
        {filteredSubscriptions.map((sub, index) => (
          <div key={index} className="subscription-card" onClick={() => setSelectedSubscription(sub)}>
            <div className="card-header">
              <span className="category-badge">{sub.category}</span>
              <span className={`status-badge ${sub.isVerified ? 'verified' : 'encrypted'}`}>
                {sub.isVerified ? '✅ Verified' : '🔒 Encrypted'}
              </span>
            </div>
            <h3>{sub.name}</h3>
            <p>{sub.description}</p>
            <div className="card-footer">
              <span>By {sub.creator.substring(0, 6)}...{sub.creator.substring(38)}</span>
              <span>{new Date(sub.timestamp * 1000).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {filteredSubscriptions.length === 0 && subscriptions.length > 0 && (
        <div className="no-results">
          <p>No subscriptions match your search criteria</p>
        </div>
      )}

      {filteredSubscriptions.length === 0 && subscriptions.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🎁</div>
          <h3>No mystery boxes yet</h3>
          <p>Create your first confidential subscription box!</p>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">Create First Box</button>
        </div>
      )}

      <div className="history-panel">
        <h4>Recent Activity</h4>
        <div className="history-list">
          {operationHistory.map((entry, index) => (
            <div key={index} className="history-entry">{entry}</div>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <CreateSubscriptionModal 
          onSubmit={createSubscription} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingSubscription} 
          subscriptionData={newSubscriptionData} 
          setSubscriptionData={setNewSubscriptionData}
          isEncrypting={isEncrypting}
        />
      )}

      {selectedSubscription && (
        <SubscriptionDetailModal 
          subscription={selectedSubscription} 
          onClose={() => setSelectedSubscription(null)} 
          decryptPreference={decryptPreference}
          isDecrypting={fheIsDecrypting}
        />
      )}

      {showFAQ && (
        <FAQModal onClose={() => setShowFAQ(false)} />
      )}

      {transactionStatus.visible && (
        <div className={`transaction-toast ${transactionStatus.status}`}>
          <div className="toast-content">
            {transactionStatus.status === "pending" && <div className="spinner"></div>}
            {transactionStatus.status === "success" && <span>✅</span>}
            {transactionStatus.status === "error" && <span>❌</span>}
            <span>{transactionStatus.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateSubscriptionModal: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  subscriptionData: any;
  setSubscriptionData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, subscriptionData, setSubscriptionData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'preference') {
      const intValue = value.replace(/[^\d]/g, '');
      setSubscriptionData({ ...subscriptionData, [name]: intValue });
    } else {
      setSubscriptionData({ ...subscriptionData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create Confidential Subscription</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <span>🔐</span>
            <div>
              <strong>FHE Protection Active</strong>
              <p>Your preference score will be encrypted using homomorphic encryption</p>
            </div>
          </div>

          <div className="form-group">
            <label>Box Name *</label>
            <input 
              type="text" 
              name="name" 
              value={subscriptionData.name} 
              onChange={handleChange} 
              placeholder="Awesome Mystery Box" 
            />
          </div>

          <div className="form-group">
            <label>Category *</label>
            <select name="category" value={subscriptionData.category} onChange={handleChange}>
              <option value="electronics">Electronics</option>
              <option value="fashion">Fashion</option>
              <option value="books">Books</option>
              <option value="food">Food & Snacks</option>
              <option value="beauty">Beauty</option>
              <option value="sports">Sports</option>
            </select>
          </div>

          <div className="form-group">
            <label>Preference Score (1-100) *</label>
            <input 
              type="number" 
              name="preference" 
              min="1" 
              max="100" 
              value={subscriptionData.preference} 
              onChange={handleChange} 
              placeholder="Enter your preference intensity" 
            />
            <small>This will be FHE encrypted for private matching</small>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description" 
              value={subscriptionData.description} 
              onChange={handleChange} 
              placeholder="Describe what kind of surprises you'd like..." 
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !subscriptionData.name || !subscriptionData.preference} 
            className="btn-primary"
          >
            {creating || isEncrypting ? "🔐 Encrypting..." : "Create Mystery Box"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SubscriptionDetailModal: React.FC<{
  subscription: any;
  onClose: () => void;
  decryptPreference: (id: string) => Promise<number | null>;
  isDecrypting: boolean;
}> = ({ subscription, onClose, decryptPreference, isDecrypting }) => {
  const [decryptedValue, setDecryptedValue] = useState<number | null>(null);

  const handleDecrypt = async () => {
    const value = await decryptPreference(subscription.id);
    setDecryptedValue(value);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <h2>{subscription.name}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <label>Category</label>
              <span className="category-tag">{subscription.category}</span>
            </div>
            <div className="detail-item">
              <label>Created</label>
              <span>{new Date(subscription.timestamp * 1000).toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <label>Creator</label>
              <span>{subscription.creator}</span>
            </div>
            <div className="detail-item">
              <label>Status</label>
              <span className={`status ${subscription.isVerified ? 'verified' : 'encrypted'}`}>
                {subscription.isVerified ? '✅ Preference Verified' : '🔒 Encrypted Preference'}
              </span>
            </div>
          </div>

          <div className="description-section">
            <h4>Description</h4>
            <p>{subscription.description}</p>
          </div>

          <div className="preference-section">
            <h4>Preference Data</h4>
            <div className="preference-display">
              <div className="encrypted-data">
                <span className="data-label">Encrypted Preference:</span>
                <span className="data-value">🔒 FHE-Protected Integer</span>
              </div>
              
              {(subscription.isVerified || decryptedValue !== null) && (
                <div className="decrypted-data">
                  <span className="data-label">Decrypted Preference Score:</span>
                  <span className="data-value highlight">
                    {subscription.isVerified ? subscription.decryptedValue : decryptedValue}
                  </span>
                  <span className="data-badge">Homomorphically Matched</span>
                </div>
              )}

              <button 
                onClick={handleDecrypt} 
                disabled={isDecrypting || subscription.isVerified}
                className={`decrypt-btn ${subscription.isVerified ? 'verified' : ''}`}
              >
                {isDecrypting ? "🔓 Decrypting..." : 
                 subscription.isVerified ? "✅ Already Verified" : 
                 "🔓 Decrypt Preference"}
              </button>
            </div>
          </div>

          <div className="fhe-explanation">
            <h4>🔐 How FHE Protects Your Preference</h4>
            <div className="explanation-steps">
              <div className="step">
                <span>1</span>
                <p>Your preference score is encrypted on-chain using FHE</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>Merchants perform homomorphic matching without seeing your actual score</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Only you can decrypt the matched results for verification</p>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Close</button>
          {!subscription.isVerified && (
            <button onClick={handleDecrypt} disabled={isDecrypting} className="btn-primary">
              Verify Matching
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const FAQModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const faqs = [
    {
      question: "How does FHE protect my preferences?",
      answer: "Your preference scores are encrypted using Fully Homomorphic Encryption, allowing merchants to match products without ever seeing your actual preferences."
    },
    {
      question: "Can merchants see what I like?",
      answer: "No! Merchants only see encrypted data and perform computations on ciphertext. Your actual preferences remain completely private."
    },
    {
      question: "How do I verify the matching?",
      answer: "You can decrypt and verify the matching results at any time using your private key. The system provides cryptographic proof of correct matching."
    },
    {
      question: "What kind of preferences can I set?",
      answer: "Currently, we support integer scores (1-100) for different categories. More preference types coming soon!"
    }
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <h2>FHE Subscription Box FAQ</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div key={index} className="faq-item">
                <h4>❓ {faq.question}</h4>
                <p>{faq.answer}</p>
              </div>
            ))}
          </div>
          
          <div className="tech-info">
            <h4>🔧 Technical Details</h4>
            <p>This dApp uses Zama's fhEVM for on-chain FHE operations. Preferences are encrypted as euint32 and merchants use homomorphic operations for matching.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;


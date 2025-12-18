use wasm_bindgen::prelude::*;
use aes_gcm::{
    aead::{Aead, KeyInit, AeadCore},
    Aes256Gcm, Nonce
};
use rand::{Rng, thread_rng};
use zeroize::Zeroize;

#[wasm_bindgen]
pub fn generate_key() -> Vec<u8> {
    let mut key = [0u8; 32];
    thread_rng().fill(&mut key);
    key.to_vec()
}

#[wasm_bindgen]
pub fn encrypt_chunk(chunk: &[u8], key_bytes: &[u8]) -> Result<Vec<u8>, JsValue> {
    // Key length check
    if key_bytes.len() != 32 {
        return Err(JsValue::from_str("Invalid key length"));
    }
    
    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|e| JsValue::from_str(&format!("Key error: {}", e)))?;

    let nonce = Aes256Gcm::generate_nonce(&mut thread_rng());
    
    let mut ciphertext = cipher.encrypt(&nonce, chunk)
        .map_err(|e| JsValue::from_str(&format!("Encryption error: {}", e)))?;

    // Prepend nonce to ciphertext
    let mut result = nonce.to_vec();
    result.append(&mut ciphertext);
    
    Ok(result)
}

#[wasm_bindgen]
pub fn decrypt_chunk_session_bound(encrypted_chunk: &[u8], key_bytes: &[u8]) -> Result<Vec<u8>, JsValue> {
     if key_bytes.len() != 32 {
        return Err(JsValue::from_str("Invalid key length"));
    }
    
    if encrypted_chunk.len() < 12 {
         return Err(JsValue::from_str("Invalid chunk length"));
    }

    let cipher = Aes256Gcm::new_from_slice(key_bytes)
         .map_err(|e| JsValue::from_str(&format!("Key error: {}", e)))?;

    let nonce = Nonce::from_slice(&encrypted_chunk[..12]);
    let ciphertext = &encrypted_chunk[12..];

    let plaintext = cipher.decrypt(nonce, ciphertext)
         .map_err(|e| JsValue::from_str(&format!("Decryption error: {}", e)))?;
         
    // In a real session binding scenario, we might re-encrypt here with a session key.
    // For now, we return the plaintext as this is the core primitive requested "decrypt_chunk".
    // The "session bound" aspect implies we might do more, but per prompt: "decrypts -> Play".
    // Zeroizing the plaintext is handled by the caller or memory management, but we can verify key hygiene.
    
    Ok(plaintext)
}

// Internal helper for memory safety if needed, but Zeroize is trait based.
#[wasm_bindgen]
pub struct SecureBuffer {
    data: Vec<u8>,
}

#[wasm_bindgen]
impl SecureBuffer {
    pub fn new(data: Vec<u8>) -> Self {
        Self { data }
    }
    
    pub fn get_data(&self) -> Vec<u8> {
        self.data.clone()
    }
}

impl Drop for SecureBuffer {
    fn drop(&mut self) {
        self.data.zeroize();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_keygen() {
        let key = generate_key();
        assert_eq!(key.len(), 32);
        assert_ne!(key, [0u8; 32].to_vec());
    }

    #[wasm_bindgen_test]
    fn test_encryption_decryption() {
        let key = generate_key();
        let data = b"Hello World";
        
        let encrypted = encrypt_chunk(data, &key).unwrap();
        assert_ne!(encrypted, data);
        
        let decrypted = decrypt_chunk_session_bound(&encrypted, &key).unwrap();
        assert_eq!(decrypted, data);
    }

    #[wasm_bindgen_test]
    fn test_wrong_key() {
        let key1 = generate_key();
        let key2 = generate_key();
        let data = b"Secret";
        
        let encrypted = encrypt_chunk(data, &key1).unwrap();
        let result = decrypt_chunk_session_bound(&encrypted, &key2);
        
        assert!(result.is_err());
    }

    #[wasm_bindgen_test]
    fn test_tampered_data() {
        let key = generate_key();
        let data = b"Sensitive";
        
        let mut encrypted = encrypt_chunk(data, &key).unwrap();
        // Tamper with the ciphertext (last byte)
        let len = encrypted.len();
        encrypted[len-1] ^= 0xFF;
        
        let result = decrypt_chunk_session_bound(&encrypted, &key);
        assert!(result.is_err());
    }
}


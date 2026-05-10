#[allow(dead_code)]
pub struct WslConfirmation {
    pub confirm_terminate: bool,
    pub confirm_data_loss: bool,
}

impl WslConfirmation {
    #[allow(dead_code)]
    pub fn is_confirmed(&self) -> bool {
        self.confirm_terminate && self.confirm_data_loss
    }
}

pub struct WslConfirmation {
    pub confirm_terminate: bool,
    pub confirm_data_loss: bool,
}

impl WslConfirmation {
    pub fn is_confirmed(&self) -> bool {
        self.confirm_terminate && self.confirm_data_loss
    }
}
